import { useState } from 'react';
import { getFundingGuide } from '../data/funding-guides';

type Tab = 'guide' | 'centers';

export default function StateRegulatoryGuide() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<Tab>('guide');

  const guide = getFundingGuide('CA');
  if (!guide) return null;

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
          {(['guide', 'centers'] as Tab[]).map((tab) => {
            const label = tab === 'guide' ? 'State Guide' : 'Regional Centers';
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
        {activeTab === 'guide' ? (
          <div className="divide-y divide-slate-100">
            {guide.faqs.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                  aria-expanded={openIndex === i}
                >
                  <span className="font-ui text-sm font-semibold text-[#1E3A5F] pr-4">{faq.question}</span>
                  <span
                    className={`text-slate-400 text-sm shrink-0 transition-transform duration-200 ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {openIndex === i && (
                  <div className="px-5 pb-4 space-y-3">
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>

                    {faq.sourceUrl && (
                      <a
                        href={faq.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C2410C] hover:text-[#A33509] hover:underline"
                      >
                        <span aria-hidden="true">📄</span>
                        {faq.sourceLabel ?? 'Official Source'}
                        <span className="opacity-60">↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Regional Centers are nonprofit organizations contracted by the state to coordinate services for people with developmental disabilities. Contact yours to begin eligibility intake.
            </p>
            <div className="space-y-4">
              {guide.localAgencies.map((agency, i) => (
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
