import { NextResponse } from "next/server";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Walk up or resolve path relative to workspace root
  const rootDir = "/Users/shreyas/Developer/srvmi/hastin";
  const pdfPath = join(rootDir, "hastyayurveda.pdf");

  if (!existsSync(pdfPath)) {
    return NextResponse.json(
      { error: "Source PDF file not found on the server" },
      { status: 404 }
    );
  }

  try {
    const fileBuffer = readFileSync(pdfPath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="hastyayurveda.pdf"',
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("PDF download error:", err);
    return NextResponse.json(
      { error: "Failed to read and serve PDF" },
      { status: 500 }
    );
  }
}
