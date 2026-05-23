import { useState } from 'react';
import { getFundingGuide } from '../data/funding-guides';

interface Props {
  selectedState: string;
  selectedCounty: string;
}

export default function StateRegulatoryGuide({ selectedState, selectedCounty }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!selectedState) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📋</span>
          <h2 className="text-base font-bold text-slate-700">Regulatory Guide</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Select a state above to see funding eligibility requirements, key documents, and how to get started.
        </p>
      </div>
    );
  }

  const guide = getFundingGuide(selectedState, selectedCounty || undefined);

  if (!guide) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-600 mb-2">{selectedState} Funding & Eligibility Guide</p>
        <p className="text-sm text-slate-500 leading-relaxed">
          Regulatory guidelines for {selectedState} are currently being updated.
          Please check your local state health and human services department for waiver eligibility.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📋</span>
          <span className="text-xs font-semibold text-blue-200 uppercase tracking-widest">
            State Guide · {selectedState}
          </span>
        </div>
        <h2 className="text-base font-bold text-white leading-snug">{guide.title}</h2>
      </div>

      {/* FAQ Accordion */}
      <div className="divide-y divide-slate-100">
        {guide.faqs.map((faq, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-semibold text-slate-700 pr-4">{faq.question}</span>
              <span
                className={`text-slate-400 text-sm shrink-0 transition-transform duration-200 ${
                  openIndex === i ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>

            {openIndex === i && (
              <div className="px-5 pb-4 space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>

                {/* Optional source link */}
                {faq.sourceUrl && (
                  <a
                    href={faq.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <span>📄</span>
                    {faq.sourceLabel ?? 'Official Source'}
                    <span className="opacity-60">↗</span>
                  </a>
                )}

              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Always verify current rules with your local administering agency.
        </p>
      </div>
    </div>
  );
}
