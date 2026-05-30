"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, Database, Code, Cpu } from "lucide-react";
import { Panel } from "@/components/motion/Panel";

export default function AboutPage() {
  return (
    <Panel className="min-h-screen bg-stone-50 text-stone-850 font-serif selection:bg-stone-200">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="p-2 rounded-full hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors duration-[120ms] ease-out cursor-pointer"
              title="Return to Reader"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-sans font-semibold">
                Hastin Platform
              </p>
              <h1 className="text-xl font-serif font-bold text-stone-900 leading-tight">
                About the Project
              </h1>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-sans items-center">
            <Link
              href="/about/data"
              className="text-stone-600 hover:text-stone-900 font-medium transition-colors duration-[120ms] ease-out"
            >
              Data Center &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        
        {/* Title Section */}
        <section className="mb-12 border-b border-stone-200 pb-8 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-bold font-serif text-stone-950 leading-tight mb-4">
            Hastin: Open-Source Manuscript Intelligence
          </h2>
          <p className="text-lg text-stone-600 font-serif leading-relaxed italic">
            Preserving legacy science, medicine, and philosophy through grounded artificial intelligence and rigorous modern digitizations.
          </p>
        </section>

        {/* 1. Mission */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            1. Mission
          </h3>
          <div className="font-sans text-sm text-stone-700 space-y-4 leading-relaxed">
            <p>
              Historical palm-leaf and block-printed scientific manuscripts represent thousands of years of human intellectual progress, yet they remain largely inaccessible. Traditional preservation focuses on physical archival or static image capture. This hides the dense, rich scientific content from global search engines, research databases, and AI intelligence layers.
            </p>
            <p>
              <strong>Hastin</strong> is an open-source manuscript intelligence platform designed to bridge this divide. It provides tools to extract, digitize, transliterate, translate, index, and analyze scientific treatises. The platform prioritizes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-stone-600 mt-2">
              <li><strong>Provenance Integrity:</strong> Linking every sentence and translation directly back to coordinate-level blocks on the original scanned paper.</li>
              <li><strong>Scholarly Transliteration:</strong> Supporting dual-script toggles between primary scripts (Devanagari) and romanized standards (IAST) with strict diacritic fidelity.</li>
              <li><strong>Contextual AI Grounding:</strong> Powering semantic conversational tools that can quote exact chapter, page, and verse coordinates, adhering to a strict <em>&ldquo;No citation &rarr; no answer&rdquo;</em> integrity policy.</li>
            </ul>
          </div>
        </section>

        {/* 2. Pipeline */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            2. Ingestion Pipeline
          </h3>
          <div className="font-sans text-sm text-stone-700 space-y-4 leading-relaxed">
            <p>
              Digital treatises do not start as structured databases. Hastin implements a multi-stage deterministic pipeline to transform scanned folios into structured intelligence:
            </p>
            
            <div className="space-y-3 mt-4">
              <div className="flex gap-4 p-4 rounded-xl bg-white border border-stone-200">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold font-mono text-xs">
                  01
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wide font-sans">
                    Page Extraction & Scan Storage
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                    Raw treatise PDFs are loaded, rendered into ultra-high-resolution grayscale PNGs, and pushed directly to Cloudflare R2 storage while creating exact coordinate-tracked Page records in a PostgreSQL database.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white border border-stone-200">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold font-mono text-xs">
                  02
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wide font-sans">
                    Sarvam Akshar OCR
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                     Grayscale page scans are batched and processed through <em>Sarvam Akshar</em> model endpoints to retrieve high-fidelity raw Devanagari Sanskrit lines. All responses are logged and persisted in a raw form to maintain mathematical reproducibility.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white border border-stone-200">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold font-mono text-xs">
                  03
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wide font-sans">
                    Block Segmentation & Transliteration
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                    Heuristic parsers segregate text into logical structural components: <strong>Verses</strong>, <strong>Prose blocks</strong>, <strong>Headings</strong>, and <strong>Footnotes</strong>. The segmented Devanagari Sanskrit is then dynamically mapped to International Alphabet of Sanskrit Transliteration (IAST) diacritics using high-precision character mapping rules.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white border border-stone-200">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold font-mono text-xs">
                  04
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wide font-sans">
                    Claude AI Contextual Translation
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                    Blocks are routed to Anthropic Claude model endpoints equipped with technical dictionaries. The AI executes context-sensitive English translations of Sanskrit scientific vocabulary, maintaining terminology consistency across verses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Technology */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            3. Technology Stack
          </h3>
          <div className="font-sans text-sm text-stone-700 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-stone-200 rounded-xl flex gap-3 items-start">
              <Cpu className="w-5 h-5 text-stone-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">Frontend Portal</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Next.js 14 (App Router), React, TypeScript, TailwindCSS, Framer Motion for scholarly motion curves, and Lucide icons.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded-xl flex gap-3 items-start">
              <Database className="w-5 h-5 text-stone-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">Database & Search</h4>
                <p className="text-xs text-stone-500 mt-1">
                  PostgreSQL 16 with trgm GIN index expansions for sub-linear lexical matches across multi-script headers (Devanagari, IAST, English).
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded-xl flex gap-3 items-start">
              <Sparkles className="w-5 h-5 text-stone-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">AI & OCR Ingestion</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Anthropic Claude (Messages & Thinking APIs) for contextual translation and RAG querying. Sarvam Akshar OCR for Devangari transcription.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded-xl flex gap-3 items-start">
              <Code className="w-5 h-5 text-stone-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-800">Deployment</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Pnpm workspace monorepo, hosted on Vercel (Next.js server-rendered routes) with connection limits for PostgreSQL.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Architecture */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            4. Architecture
          </h3>
          <div className="font-sans text-sm text-stone-700 space-y-4 leading-relaxed">
            <p>
              The platform is architected as a modular monorepo containing application shells and decoupled package domains. This design ensures that ingestion, storage, and visual presentation layers can be developed, tested, and scaled independently:
            </p>
            <div className="font-mono text-xs p-4 bg-stone-100 rounded-lg text-stone-800 leading-relaxed overflow-x-auto border border-stone-200">
              {`hastin/
├── apps/
│   └── web/              # Next.js 14 App Router portal & search APIs
├── packages/
│   └── db/               # decoupling PostgreSQL driver and migration scripts
├── scripts/
│   ├── 01_extract.py     # PDF parsing and image extraction
│   ├── 02_ocr_pages.py   # Sarvam Akshar API orchestration
│   ├── 03_parse_blocks.py# layout heuristic segmentations
│   └── 05_translate.py   # Claude translation agent worker
└── docs/                 # project technical specifications`}
            </div>
          </div>
        </section>

        {/* 5. Hastyayurveda */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            5. The Hastyayurveda
          </h3>
          <div className="font-sans text-sm text-stone-700 space-y-4 leading-relaxed">
            <p>
              The reference implementation of the Hastin platform digitizes the <strong>Hastyayurveda</strong> (sometimes called the <em>Gajayurveda</em> or <em>Pālakāpya Saṃhitā</em>). This monumental Sanskrit scientific text is the oldest surviving treatise dedicated entirely to elephant biology, behavior, training, pathology, and therapy.
            </p>
            <p>
              Attributed to the ancient sage <strong>Pālakāpya</strong> and structured as a dialogue in the court of King Rājā Romapāda of Aṅga, the text contains 160 chapters divided into four major divisions (<em>sthānas</em>):
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-stone-600 mt-2">
              <li><strong>Mahārogasthāna:</strong> Major system disorders, anatomy, and psychological behavioral categories.</li>
              <li><strong>Kṣudrarogasthāna:</strong> Minor ailments, local afflictions, and practical clinical procedures.</li>
              <li><strong>Śalyasthāna:</strong> Surgical practices, physical extraction, and cauterization methodologies.</li>
              <li><strong>Uttarasthāna:</strong> General care, dietary preparations, medicinal recipes (ghees and decoctions), and detailed guidelines on daily bathing and maintenance schedules.</li>
            </ol>
            <p>
              Digitizing this corpus requires robust technical parsing to represent elaborate clinical procedures, botanical recipes, and metric Sanskrit verses accurately.
            </p>
          </div>
        </section>

        {/* 6. Future Open Source Framework */}
        <section className="mb-10">
          <h3 className="text-xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 font-serif">
            6. Future Roadmap
          </h3>
          <div className="font-sans text-sm text-stone-700 space-y-4 leading-relaxed">
            <p>
              Digitizing the Hastyayurveda is our Proof of Capability for the V1 release. The long-term product is the Hastin framework itself. In future versions, we intend to expand features beyond static manuscript reading to create a collaborative, decentralized intellectual space:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-stone-600 mt-2">
              <li><strong>Annotation & Commentary Layer:</strong> Allow researchers to add granular annotations, botanical mappings, and alternative readings to individual blocks.</li>
              <li><strong>GitHub-Backed Corrections:</strong> Enable open-source peer review where scholars can submit corrections to OCR mistakes or translations through standard pull requests directly into the database.</li>
              <li><strong>Pluggable Parser Ecosystem:</strong> Support bring-your-own-keys (BYO API) and Docker-packaged models, allowing local self-hosting for libraries and universities to digitize their own distinct manuscript collections.</li>
            </ul>
          </div>
        </section>

        {/* Footer info */}
        <section className="mt-16 border-t border-stone-200 pt-6 text-center text-stone-400 font-sans text-[11px] leading-relaxed">
          <p>
            Hastin is licensed under the MIT License. Digitized Hastyayurveda corpus is dedicated to the public domain.
          </p>
          <p className="mt-1">
            Built using next-generation AI and open-access data primitives.
          </p>
        </section>
      </main>
    </Panel>
  );
}
