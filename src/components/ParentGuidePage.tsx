import { useState } from 'react';
import { getFundingGuide } from '../data/funding-guides';
import type { EnrollmentBlock, EnrollmentSource } from '../types';

interface Props {
  onNavigateToFinder: () => void;
}

function isSourceArray(items: EnrollmentBlock['items']): items is EnrollmentSource[] {
  return Array.isArray(items) && items.length > 0 && typeof (items[0] as EnrollmentSource).url === 'string';
}

function renderBlock(block: EnrollmentBlock, bi: number) {
  if (block.type === 'paragraph') {
    return <p key={bi} className="text-sm text-slate-600 leading-relaxed">{block.text}</p>;
  }
  if (block.type === 'note') {
    return (
      <div key={bi} className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-sm text-amber-800 leading-relaxed">{block.text}</p>
      </div>
    );
  }
  if (block.type === 'bullets' || block.type === 'steps') {
    const isSteps = block.type === 'steps';
    const stringItems = (block.items ?? []) as string[];
    return (
      <div key={bi}>
        {block.heading && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-1">{block.heading}</p>
        )}
        {isSteps ? (
          <ol className="space-y-3 list-none">
            {stringItems.map((item, ii) => (
              <li key={ii} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center">{ii + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2">
            {stringItems.map((item, ii) => (
              <li key={ii} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C2410C]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (block.type === 'questions') {
    return (
      <div key={bi} className="space-y-5">
        {(block.groups ?? []).map((group, gi) => (
          <div key={gi}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.heading}</p>
            <ul className="space-y-2">
              {group.questions.map((q, qi) => (
                <li key={qi} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                  <span className="shrink-0 mt-0.5 text-[#C2410C] font-bold text-sm" aria-hidden="true">?</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === 'resources' && isSourceArray(block.items)) {
    return (
      <div key={bi} className="space-y-2.5">
        {(block.items as EnrollmentSource[]).map((res, ri) => (
          <a
            key={ri}
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#C2410C] hover:text-[#A33509] hover:underline leading-snug"
          >
            <span className="shrink-0" aria-hidden="true">📄</span>
            {res.label}
            <span className="opacity-60 text-xs">↗</span>
          </a>
        ))}
      </div>
    );
  }
  return null;
}

export default function ParentGuidePage({ onNavigateToFinder }: Props) {
  const [openSection, setOpenSection] = useState<number | null>(0);
  const guide = getFundingGuide('CA');
  if (!guide) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Page header */}
      <div className="bg-[#1E3A5F] py-14">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-blue-300 text-xs font-ui font-semibold uppercase tracking-widest mb-3">
            California · Regional Center System
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white mb-4">
            Parent Guide
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-2xl">
            Everything families need to know about California's Regional Center system — eligibility, enrollment, your rights, and how to choose a program.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">

        {/* Enrollment guide */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1E3A5F] mb-1">Enrollment Guide</h2>
          <p className="text-sm text-slate-500 mb-5">Step-by-step guidance for families navigating the Regional Center system for the first time.</p>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {guide.enrollmentGuide.map((section, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpenSection(openSection === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                    aria-expanded={openSection === i}
                  >
                    <span className="font-ui text-sm font-semibold text-[#1E3A5F] pr-4">{section.title}</span>
                    <span
                      className={`text-slate-400 text-sm shrink-0 transition-transform duration-200 ${openSection === i ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >▾</span>
                  </button>

                  {openSection === i && (
                    <div className="px-6 pb-6 space-y-4">
                      {section.blocks.map((block, bi) => renderBlock(block, bi))}
                      {(section.sources ?? []).length > 0 && (
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-1">
                          {section.sources!.map((src, si) => (
                            <a
                              key={si}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[#C2410C] hover:underline"
                            >
                              <span aria-hidden="true">📄</span>
                              {src.label}
                              <span className="opacity-60">↗</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Program types */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1E3A5F] mb-1">Program Types</h2>
          <p className="text-sm text-slate-500 mb-5">The four types of programs you'll find in this directory and what makes each different.</p>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <dl className="space-y-6">
              {(guide.careTypeDefinitions ?? []).map((item) => (
                <div key={item.term}>
                  <dt className="text-sm font-semibold text-[#1E3A5F] font-ui">{item.term}</dt>
                  <dd className="text-sm text-slate-600 leading-relaxed mt-1">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Glossary */}
        <section>
          <h2 className="font-display text-xl font-semibold text-[#1E3A5F] mb-1">Glossary</h2>
          <p className="text-sm text-slate-500 mb-5">Key terms you'll encounter when working with California's Regional Center system.</p>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <dl className="space-y-6">
              {(guide.glossary ?? []).map((item) => (
                <div key={item.term}>
                  <dt className="text-sm font-semibold text-[#1E3A5F] font-ui">{item.term}</dt>
                  <dd className="text-sm text-slate-600 leading-relaxed mt-1">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Back to finder CTA */}
        <div className="text-center pt-2 pb-4">
          <button
            onClick={onNavigateToFinder}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#C2410C] hover:bg-[#A33509] active:bg-[#8A2E07] text-white font-ui font-semibold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            ← Search Programs
          </button>
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display italic text-white/80 text-base">Exceptional Care Finder</span>
          <span className="font-ui text-sm text-white/50">
            Always verify current rules with your Regional Center.
          </span>
        </div>
      </footer>
    </div>
  );
}
