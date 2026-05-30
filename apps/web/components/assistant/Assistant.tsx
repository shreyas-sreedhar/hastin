"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Send, 
  X, 
  BookOpen, 
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { chatPanelVariants, DURATION, EASE } from "@/lib/motion";

type Message = {
  role: "user" | "assistant";
  content: string;
  blocks?: Array<{
    id: string;
    block_type: string;
    page_number: number;
    block_content: string;
    iast_text: string | null;
    translation: string | null;
  }>;
};

export function Assistant({
  documentTitle,
  pageNumber,
}: {
  documentTitle: string;
  pageNumber: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Greetings! I am the Hastin Manuscript Assistant. 

Ask me any question about the Hastyayurveda, and I will search the digitized manuscript blocks to provide scholarly, grounded answers with citations.`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Scroll messages container to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history = [...messages, userMessage];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          documentTitle,
          pageNumber,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          blocks: data.blocks,
        },
      ]);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Failed to contact assistant server. Please verify Anthropic API key.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `An error occurred: ${errMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitationClick = (blockId: string, citedPageNumber: number) => {
    if (citedPageNumber === pageNumber) {
      // Direct scroll on same page
      const url = new URL(window.location.href);
      url.searchParams.set("highlight", blockId);
      window.history.pushState(null, "", url.toString());
      
      const element = document.getElementById(`block-${blockId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      // Navigate to different page and highlight
      router.push(`/read/${encodeURIComponent(documentTitle)}/${citedPageNumber}?highlight=${blockId}`);
    }
  };

  // Helper to extract citation UUID from raw text if any
  const parseResponseWithCitations = (text: string, blocks: Message["blocks"] = []) => {
    if (!blocks || blocks.length === 0) return <span>{text}</span>;

    // We can regex match [Page P, Type T](uuid) or similar citation patterns
    // Claude is instructed to produce [Page P, Type T](uuid)
    const citationRegex = /\[Page\s+(\d+),\s*([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      // Add text before match
      if (matchIndex > lastIndex) {
        parts.push(text.slice(lastIndex, matchIndex));
      }

      const pageNumStr = match[1];
      const typeStr = match[2];
      const blockId = match[3];

      const blockInfo = blocks.find((b) => b.id === blockId);

      parts.push(
        <button
          key={blockId + "-" + matchIndex}
          onClick={() => handleCitationClick(blockId, Number.parseInt(pageNumStr, 10))}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 text-xs font-medium font-serif bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 rounded transition-colors duration-[120ms] ease-out cursor-pointer"
          title={blockInfo ? blockInfo.translation || blockInfo.block_content : "View manuscript source"}
        >
          <BookOpen className="w-3 h-3 text-amber-700" />
          p.{pageNumStr} ({typeStr})
        </button>
      );

      lastIndex = citationRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : <span>{text}</span>;
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={[
            "w-12 h-12 rounded-full flex items-center justify-center shadow-lg border cursor-pointer",
            isOpen
              ? "bg-stone-900 border-stone-800 text-stone-100"
              : "bg-white border-stone-200 text-stone-800 hover:bg-stone-50"
          ].join(" ")}
          style={{ transition: `background-color ${DURATION.hover}s ${EASE}, color ${DURATION.hover}s ${EASE}, border-color ${DURATION.hover}s ${EASE}` }}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </motion.button>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={chatPanelVariants}
            className="fixed bottom-20 right-6 z-40 w-[420px] h-[580px] bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
          >
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-stone-700" />
                <h3 className="font-serif text-sm font-semibold text-stone-800">
                  Manuscript Intelligence
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors duration-[120ms] ease-out cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-4 bg-stone-50/30"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={[
                    "flex flex-col max-w-[85%]",
                    m.role === "user" ? "ml-auto items-end" : "mr-auto items-start",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "px-4 py-3 rounded-lg text-sm leading-relaxed font-serif",
                      m.role === "user"
                        ? "bg-stone-900 text-stone-100 rounded-br-none"
                        : "bg-white border border-stone-200 text-stone-800 shadow-sm rounded-bl-none whitespace-pre-line",
                    ].join(" ")}
                  >
                    {m.role === "user" ? (
                      m.content
                    ) : (
                      parseResponseWithCitations(m.content, m.blocks)
                    )}
                  </div>

                  {/* Cited Sources section for Assistant messages */}
                  {m.role === "assistant" && m.blocks && m.blocks.length > 0 && (
                    <div className="mt-2 pl-1 space-y-1.5 w-full">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-sans font-semibold">
                        Grounded Sources
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {m.blocks.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => handleCitationClick(b.id, b.page_number)}
                            className="text-left px-2.5 py-2 bg-white border border-stone-150 rounded shadow-xs hover:border-amber-400 hover:bg-amber-50/20 group transition-all duration-[120ms] ease-out flex flex-col justify-between h-[64px] cursor-pointer"
                          >
                            <span className="text-[10px] font-sans font-medium text-stone-500 group-hover:text-amber-800 flex items-center justify-between w-full">
                              <span>Page {b.page_number} ({b.block_type})</span>
                              <ArrowUpRight className="w-2.5 h-2.5 text-stone-300 group-hover:text-amber-600 transition-colors duration-[120ms] ease-out" />
                            </span>
                            <span className="text-[11px] font-serif text-stone-700 line-clamp-2 mt-1 leading-snug group-hover:text-stone-900">
                              {b.translation || b.block_content}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex flex-col items-start max-w-[85%] mr-auto">
                  <div className="px-4 py-3 rounded-lg bg-white border border-stone-200 shadow-sm rounded-bl-none flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-stone-500 animate-spin" />
                    <span className="text-xs font-serif italic text-stone-500">
                      Searching Hastyayurveda corpus...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-stone-200 bg-white flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about training, treatments, ghee recipes..."
                className="flex-1 px-4 py-2 text-sm border border-stone-200 rounded-lg focus:outline-hidden focus:border-stone-500 font-serif"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={[
                  "p-2 rounded-lg bg-stone-900 text-white shadow-xs cursor-pointer",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-colors duration-[120ms] ease-out"
                ].join(" ")}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
