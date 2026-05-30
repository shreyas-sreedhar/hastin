import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@hastin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BlockContext = {
  id: string;
  document_title: string;
  block_type: string;
  block_order: number;
  block_content: string;
  iast_text: string | null;
  translation: string | null;
  page_number: number | null;
};

// Custom keyword extraction using Claude for high quality search queries
async function getSearchQueries(
  anthropic: Anthropic,
  question: string,
  history: Message[]
): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 150,
      system: `You are an expert Sanskrit lexicographer and search assistant for the Hastyayurveda.
Your task is to analyze the user's question (and conversation history) and output 1 to 3 optimized search keywords or short phrases.
The keywords should be in Devanagari Sanskrit, IAST transliteration, or English depending on the question's focus.
Provide ONLY a valid JSON string array, with no other text, explanation, or markdown formatting.
Example output: ["व्याधि", "elephants", "ghee"]`,
      messages: [
        ...history.slice(-3).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: "user",
          content: `Question: ${question}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const queries = JSON.parse(cleanJson);
    if (Array.isArray(queries) && queries.every((q) => typeof q === "string")) {
      return queries.filter((q) => q.trim().length > 1);
    }
  } catch (e) {
    console.error("Error generating search queries:", e);
  }

  // Fallback to simple words in question
  return question
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0900-\u097F]/g, ""))
    .filter((w) => w.length > 3)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages, documentTitle, pageNumber } = body as {
    messages?: Message[];
    documentTitle?: string;
    pageNumber?: number;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg.role !== "user") {
    return NextResponse.json(
      { error: "last message must be from user" },
      { status: 400 }
    );
  }

  const sql = getDb();
  const anthropic = new Anthropic({ apiKey });

  // 1. Generate optimized keywords using Claude
  const keywords = await getSearchQueries(anthropic, lastUserMsg.content, messages.slice(0, -1));
  console.log("Extracted search keywords:", keywords);

  // 2. Query database for blocks matching these keywords
  const retrievedBlocks: BlockContext[] = [];
  const seenIds = new Set<string>();

  if (keywords.length > 0) {
    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      try {
        const rows = await sql<BlockContext[]>`
          SELECT b.id, b.block_type, b.block_order, b.block_content, 
                 b.iast_text, b.translation, b.page_number, d.title as document_title
          FROM blocks b
          JOIN documents d ON d.id = b.document_id
          WHERE b.block_content ILIKE ${pattern} 
             OR b.iast_text ILIKE ${pattern} 
             OR b.translation ILIKE ${pattern}
          ORDER BY b.page_number ASC, b.block_order ASC
          LIMIT 8
        `;
        for (const row of rows) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id);
            retrievedBlocks.push(row);
          }
        }
      } catch (err) {
        console.error(`Search error for keyword "${kw}":`, err);
      }
    }
  }

  // Also pull blocks of the current page as immediate high-priority context
  if (documentTitle && pageNumber) {
    try {
      const pageRows = await sql<BlockContext[]>`
        SELECT b.id, b.block_type, b.block_order, b.block_content, 
               b.iast_text, b.translation, b.page_number, d.title as document_title
        FROM blocks b
        JOIN documents d ON d.id = b.document_id
        JOIN pages p ON p.id = b.page_id
        WHERE d.title = ${documentTitle} AND p.page_number = ${pageNumber}
        ORDER BY b.block_order ASC
      `;
      for (const row of pageRows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          retrievedBlocks.push(row);
        }
      }
    } catch (err) {
      console.error("Error retrieving current page blocks:", err);
    }
  }

  // Limit total context size to top 15 blocks
  const finalBlocks = retrievedBlocks.slice(0, 15);

  // 3. Construct Claude prompt and generate the grounded response
  const formattedBlocksText = finalBlocks
    .map(
      (b, idx) => `[Block ${idx + 1}]
ID: ${b.id}
Document: ${b.document_title}
Page: ${b.page_number}
Type: ${b.block_type}
Sanskrit (Devanagari): ${b.block_content}
Sanskrit (IAST): ${b.iast_text ?? "—"}
English Translation: ${b.translation ?? "—"}`
    )
    .join("\n\n");

  const systemPrompt = `You are a scholarly manuscript intelligence assistant for Hastin, an open-source manuscript intelligence platform.
Your current goal is to help the user explore the Hastyayurveda corpus, a historical Sanskrit treatise on elephants.

You must answer the user's question strictly grounded in the provided database blocks from the manuscript.

RULES:
1. Grounding: Answer ONLY using the facts, verses, and translations present in the provided blocks. Do NOT assume, speculate, or bring in outside historical details unless they directly translate or explain a specific Sanskrit word in the provided blocks.
2. Citations: Every claim or fact you mention MUST be followed by a clickable markdown citation pointing to the source block's ID. Use EXACTLY this format: [Page P, Type T](block-uuid), where P is the page_number, T is the block_type (e.g. Verse, Prose, Footnote), and block-uuid is the exact block ID.
   Example: "Elephants should be bathed in the morning [Page 30, Verse](1234-5678)."
3. Strict Citation Rule (Rule 3): Every answer must cite source blocks. If the provided blocks do not contain the answer, you must state: "I cannot find the answer in the current Hastyayurveda corpus." Do not provide any uncited information.
4. Tone: Academic, helpful, calm, highly precise. Avoid enthusiastic conversational filler. Use clear paragraphs.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here are the relevant database blocks from the Hastyayurveda:

${formattedBlocksText || "No matching blocks found."}

Please answer this user question:
"${lastUserMsg.content}"`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      answer: text,
      blocks: finalBlocks.map((b) => ({
        id: b.id,
        block_type: b.block_type,
        page_number: b.page_number,
        block_content: b.block_content,
        iast_text: b.iast_text,
        translation: b.translation,
      })),
    });
  } catch (err) {
    console.error("Claude call error:", err);
    return NextResponse.json(
      { error: "Failed to generate AI response from Claude" },
      { status: 500 }
    );
  }
}
