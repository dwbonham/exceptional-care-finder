import { useState, useEffect } from 'react';
import { getFundingGuide } from '../data/funding-guides';
import type { EnrollmentBlock, EnrollmentSource } from '../types';

interface Props {
  onNavigateToFinder: () => void;
}

const TOC_SECTIONS = [
  { id: 'enrollment-guide', label: 'Enrollment Guide' },
  { id: 'program-types',    label: 'Program Types'    },
  { id: 'glossary',         label: 'Glossary'         },
];

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

function TocLinks({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
  return (
    <nav className="space-y-0.5">
      {TOC_SECTIONS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer border-l-2 ${
            activeId === id
              ? 'border-[#C2410C] bg-[#FEF2EE] text-[#C2410C] font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export default function ParentGuidePage({ onNavigateToFinder }: Props) {
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [activeId, setActiveId] = useState(TOC_SECTIONS[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);

  const guide = getFundingGuide('CA');

  useEffect(() => {
    function onScroll() {
      const found = [...TOC_SECTIONS].reverse().find(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.getBoundingClientRect().top <= window.innerHeight * 0.35;
      });
      if (found) setActiveId(found.id);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function navigateTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  }

  if (!guide) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">

      {/* Page header — matches About page style */}
      <div
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}enrollment-bg.jpeg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.50)' }} />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-4 py-1.5 mb-5">
            <span className="text-yellow-300 text-sm">✦</span>
            <span className="text-white/90 text-sm font-medium tracking-wide">California · Regional Center System</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-tight mb-5">
            California <em className="italic text-blue-200">Enrollment Guide</em>
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto">
            For families, caregivers, and advocates navigating California's Regional Center system — eligibility, enrollment, your rights, and how to choose a program.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex gap-10 xl:gap-14 items-start">

          {/* Desktop sidebar ToC */}
          <aside className="hidden lg:block w-48 xl:w-52 shrink-0 sticky top-24 self-start">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-3">
              On this page
            </p>
            <TocLinks activeId={activeId} onNavigate={navigateTo} />
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Mobile "On this page" collapsible */}
            <div className="lg:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>On this page</span>
                <span className={`text-slate-400 text-xs transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {mobileOpen && (
                <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                  <TocLinks activeId={activeId} onNavigate={navigateTo} />
                </div>
              )}
            </div>

            {/* Enrollment guide */}
            <section id="enrollment-guide" className="scroll-mt-24">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">Enrollment Guide</h2>
                <p className="text-sm text-slate-500 mt-1">Step-by-step guidance for anyone navigating the Regional Center system for the first time.</p>
              </div>
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
            <section id="program-types" className="scroll-mt-24">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">Program Types</h2>
                <p className="text-sm text-slate-500 mt-1">The four types of programs in this directory and what makes each different.</p>
              </div>
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
            <section id="glossary" className="scroll-mt-24">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">Glossary</h2>
                <p className="text-sm text-slate-500 mt-1">Key terms you'll encounter when working with the Regional Center system.</p>
              </div>
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

            {/* Back to finder */}
            <div className="text-center pt-2 pb-6">
              <button
                onClick={onNavigateToFinder}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#C2410C] hover:bg-[#A33509] active:bg-[#8A2E07] text-white font-ui font-semibold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                ← Search Programs
              </button>
            </div>

          </div>
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
