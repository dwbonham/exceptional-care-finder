import { useState } from 'react';
import { getFundingGuide } from '../data/funding-guides';
import type { EnrollmentBlock, EnrollmentSource } from '../types';

type Tab = 'enrollment' | 'centers' | 'glossary';

interface Props {
  selectedCounty?: string;
  selectedLaZip?: string;
}

function isSourceArray(items: EnrollmentBlock['items']): items is EnrollmentSource[] {
  return Array.isArray(items) && items.length > 0 && typeof (items[0] as EnrollmentSource).url === 'string';
}

export default function StateRegulatoryGuide({ selectedCounty, selectedLaZip }: Props = {}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<Tab>('enrollment');

  const guide = getFundingGuide('CA');
  if (!guide) return null;

  const filteredGuide = getFundingGuide('CA', selectedLaZip || undefined, selectedCounty || undefined);
  const isLaNoZip = selectedCounty === 'Los Angeles' && !selectedLaZip;
  const isLaZipNotFound = selectedCounty === 'Los Angeles' && !!selectedLaZip && filteredGuide?.localAgencies.length === 0;
  const laFallbackGuide = isLaZipNotFound ? getFundingGuide('CA', undefined, 'Los Angeles') : null;
  const agenciesToShow = isLaZipNotFound
    ? (laFallbackGuide?.localAgencies ?? guide.localAgencies)
    : (filteredGuide?.localAgencies ?? guide.localAgencies);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
      {/* Header — fixed */}
      <div className="px-6 pt-5 shrink-0 bg-[#1E3A5F]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg" aria-hidden="true">📋</span>
          <span className="text-xs font-ui font-semibold text-blue-200 uppercase tracking-widest">
            State Guide · CA
          </span>
        </div>
        <h2 className="font-display text-base font-semibold text-white leading-snug mb-4">{guide.title}</h2>

        {/* Tab strip */}
        <div className="flex -mx-6 px-6" role="tablist">
          {(['enrollment', 'centers', 'glossary'] as Tab[]).map((tab) => {
            const label = tab === 'enrollment' ? 'Get Started' : tab === 'centers' ? 'Regional Centers' : 'Glossary';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-ui font-semibold transition-colors duration-150 border-b-2 ${
                  isActive
                    ? 'text-white border-[#C2410C]'
                    : 'text-blue-200/70 border-transparent hover:text-blue-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {activeTab === 'enrollment' ? (
          <div className="divide-y divide-slate-100">
            {guide.enrollmentGuide.map((section, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                  aria-expanded={openIndex === i}
                >
                  <span className="font-ui text-sm font-semibold text-[#1E3A5F] pr-4">{section.title}</span>
                  <span
                    className={`text-slate-400 text-sm shrink-0 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >▾</span>
                </button>

                {openIndex === i && (
                  <div className="px-5 pb-5 space-y-3">
                    {section.blocks.map((block, bi) => {
                      if (block.type === 'paragraph') {
                        return <p key={bi} className="text-sm text-slate-600 leading-relaxed">{block.text}</p>;
                      }
                      if (block.type === 'note') {
                        return (
                          <div key={bi} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                            <p className="text-xs text-amber-800 leading-relaxed">{block.text}</p>
                          </div>
                        );
                      }
                      if (block.type === 'bullets' || block.type === 'steps') {
                        const isSteps = block.type === 'steps';
                        const stringItems = (block.items ?? []) as string[];
                        return (
                          <div key={bi}>
                            {block.heading && (
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{block.heading}</p>
                            )}
                            {isSteps ? (
                              <ol className="space-y-2 list-none">
                                {stringItems.map((item, ii) => (
                                  <li key={ii} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center">{ii + 1}</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <ul className="space-y-1.5">
                                {stringItems.map((item, ii) => (
                                  <li key={ii} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
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
                          <div key={bi} className="space-y-4">
                            {(block.groups ?? []).map((group, gi) => (
                              <div key={gi}>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{group.heading}</p>
                                <ul className="space-y-1.5">
                                  {group.questions.map((q, qi) => (
                                    <li key={qi} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                                      <span className="shrink-0 mt-1 text-[#C2410C] text-xs font-bold">?</span>
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
                          <div key={bi} className="space-y-2">
                            {(block.items as EnrollmentSource[]).map((res, ri) => (
                              <a
                                key={ri}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-[#C2410C] hover:text-[#A33509] hover:underline leading-snug"
                              >
                                <span className="shrink-0 text-xs" aria-hidden="true">📄</span>
                                {res.label}
                                <span className="opacity-60 text-xs">↗</span>
                              </a>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })}

                    {(section.sources ?? []).length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
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
        ) : activeTab === 'glossary' ? (
          <div className="px-5 py-4 space-y-6">
            {/* Care Type Definitions */}
            {(guide.careTypeDefinitions ?? []).length > 0 && (
              <div>
                <p className="text-xs font-ui font-semibold text-[#1E3A5F] uppercase tracking-widest mb-3">Program Types</p>
                <dl className="space-y-4">
                  {(guide.careTypeDefinitions ?? []).map((item) => (
                    <div key={item.term}>
                      <dt className="text-sm font-semibold text-[#1E3A5F] font-ui">{item.term}</dt>
                      <dd className="text-sm text-slate-600 leading-relaxed mt-0.5">{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Funding & System Terms */}
            {(guide.glossary ?? []).length > 0 && (
              <div>
                <p className="text-xs font-ui font-semibold text-[#1E3A5F] uppercase tracking-widest mb-3">Funding &amp; System Terms</p>
                <dl className="space-y-4">
                  {(guide.glossary ?? []).map((item) => (
                    <div key={item.term}>
                      <dt className="text-sm font-semibold text-[#1E3A5F] font-ui">{item.term}</dt>
                      <dd className="text-sm text-slate-600 leading-relaxed mt-0.5">{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Regional Centers are nonprofit organizations contracted by the state to coordinate services for people with developmental disabilities. Contact yours to begin eligibility intake.
            </p>
            {isLaNoZip && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
                LA County has 7 Regional Centers serving different areas. Enter your ZIP code above to narrow to yours.
              </p>
            )}
            {isLaZipNotFound && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
                ZIP {selectedLaZip} isn't in our coverage map yet. Call DDS at (833) 421-0061 to confirm which center serves you.
              </p>
            )}
            <div className="space-y-4">
              {agenciesToShow.map((agency, i) => (
                <div key={i} className="text-sm">
                  <p className="font-semibold text-slate-700">{agency.name}</p>
                  {agency.note && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{agency.note}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    <a
                      href={`tel:${agency.phone}`}
                      className="text-xs text-[#C2410C] hover:underline"
                    >
                      {agency.phone}
                    </a>
                    <a
                      href={agency.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C2410C] hover:underline"
                    >
                      Website ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — fixed */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 shrink-0">
        <p className="text-xs text-slate-400">
          Always verify current rules with your local administering agency.
        </p>
      </div>
    </div>
  );
}
