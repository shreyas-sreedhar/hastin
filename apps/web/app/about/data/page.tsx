"use client";

import Link from "next/link";
import { 
  ArrowLeft, 
  Database, 
  FileText, 
  FileCode, 
  GitBranch, 
  Download,
  BookOpen
} from "lucide-react";
import { Panel } from "@/components/motion/Panel";

export default function DataCenter() {
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
                Data & Export Center
              </h1>
            </div>
          </div>
          <div className="text-xs text-stone-500 font-sans">
            v1.0.0 reference
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <section className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-serif text-stone-950 mb-3">
            Open Access Manuscript Intelligence
          </h2>
          <p className="text-stone-600 font-sans text-sm leading-relaxed">
            In alignment with our mission for public scholarship, all digitized files, 
            transliterations, translations, and metadata for the Hastyayurveda corpus are 
            fully open-access. You can download the complete dataset or raw sources below.
          </p>
        </section>

        {/* Grid of Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Export JSON */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-serif text-stone-900 mb-2">
                Complete Corpus JSON
              </h3>
              <p className="text-stone-600 font-sans text-xs leading-relaxed mb-4">
                A single structured JSON document containing the complete hierarchical corpus: 
                documents, page references, and individual blocks. Includes original Devanagari 
                Sanskrit, IAST transliterations, and full English translations.
              </p>
            </div>
            <a 
              href="/api/export" 
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-850 font-sans text-xs font-semibold tracking-wide transition-colors duration-[120ms] ease-out shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download JSON Export
            </a>
          </div>

          {/* Original PDF */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-serif text-stone-900 mb-2">
                Treatise Source PDF
              </h3>
              <p className="text-stone-600 font-sans text-xs leading-relaxed mb-4">
                The original source manuscript PDF of the Hastyayurveda used for digitization. 
                Contains the complete treatise scans, footnotes, and annotations. 
                File size is approximately 52.8 MB.
              </p>
            </div>
            <a 
              href="/api/download/pdf" 
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-850 font-sans text-xs font-semibold tracking-wide transition-colors duration-[120ms] ease-out shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download PDF (52.8 MB)
            </a>
          </div>

          {/* View llms.txt */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
                <FileCode className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-serif text-stone-900 mb-2">
                LLM-Optimized Mapping (llms.txt)
              </h3>
              <p className="text-stone-600 font-sans text-xs leading-relaxed mb-4">
                A highly compressed, semantically optimized markdown index of the 
                Hastyayurveda corpus (`llms.txt`). Perfect for ingestion into RAG context 
                windows, custom AI assistants, or vector search databases.
              </p>
            </div>
            <a 
              href="/llms.txt" 
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-150 font-sans text-xs font-semibold tracking-wide transition-colors duration-[120ms] ease-out cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              View llms.txt
            </a>
          </div>

          {/* GitHub Source Code */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div>
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 mb-4">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-serif text-stone-900 mb-2">
                GitHub Repository
              </h3>
              <p className="text-stone-600 font-sans text-xs leading-relaxed mb-4">
                Hastin is an open-source framework. Access our complete codebase, database 
                migrations, ingestion scripts (OCR page extractors, translation workers, 
                and search indexes), and frontend code to self-host your own manuscript portal.
              </p>
            </div>
            <a 
              href="https://github.com/shreyas-sreedhar/hastin" 
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-150 font-sans text-xs font-semibold tracking-wide transition-colors duration-[120ms] ease-out cursor-pointer"
            >
              <GitBranch className="w-4 h-4" />
              View GitHub Repo
            </a>
          </div>

        </div>

        {/* Footer info */}
        <section className="mt-12 border-t border-stone-200 pt-6 text-center text-stone-400 font-sans text-[11px] leading-relaxed">
          <p>
            Hastin is licensed under the MIT License. Digitized Hastyayurveda corpus is dedicated to the public domain.
          </p>
          <p className="mt-1">
            Developed in collaboration with manuscript intelligence experts and Sanskrit scholars.
          </p>
        </section>
      </main>
    </Panel>
  );
}
