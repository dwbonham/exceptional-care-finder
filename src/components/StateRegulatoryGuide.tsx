import { getFundingGuide } from '../data/funding-guides';

interface Props {
  selectedCounty?: string;
  selectedLaZip?: string;
  onNavigateToGuide?: () => void;
}

export default function StateRegulatoryGuide({ selectedCounty, selectedLaZip, onNavigateToGuide }: Props = {}) {
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

      {/* Header */}
      <div className="px-5 pt-4 pb-4 bg-[#1E3A5F] shrink-0">
        <p className="text-xs font-ui font-semibold text-blue-200 uppercase tracking-widest mb-1.5">
          California Guide
        </p>
        <p className="text-sm text-white/80 leading-snug">
          All programs here are state-licensed and funded free through California's Regional Center system — no cost to your family.
        </p>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 min-h-0">

        {/* Program types */}
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-ui font-semibold text-[#1E3A5F] uppercase tracking-widest mb-3">
            Program Types
          </p>
          <dl className="space-y-3">
            {(guide.careTypeDefinitions ?? []).map((item) => (
              <div key={item.term}>
                <dt className="text-xs font-semibold text-slate-700">{item.term}</dt>
                <dd className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Regional Centers */}
        <div className="px-5 py-4">
          <p className="text-xs font-ui font-semibold text-[#1E3A5F] uppercase tracking-widest mb-2">
            Your Regional Center
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Regional Centers are nonprofit organizations contracted by the state to coordinate services. Contact yours to begin the eligibility process.
          </p>

          {isLaNoZip && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
              LA County has 7 Regional Centers serving different areas. Enter your ZIP code above to narrow to yours.
            </p>
          )}
          {isLaZipNotFound && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
              ZIP {selectedLaZip} isn't in our coverage map yet. Call the state helpline at (833) 421-0061 to find which Regional Center serves your area.
            </p>
          )}

          <div className="space-y-4">
            {agenciesToShow.map((agency, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-slate-700">{agency.name}</p>
                {agency.note && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{agency.note}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <a href={`tel:${agency.phone}`} className="text-xs text-[#C2410C] hover:underline">
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
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 shrink-0">
        {onNavigateToGuide ? (
          <button
            onClick={onNavigateToGuide}
            className="w-full text-xs font-ui font-semibold text-[#C2410C] hover:text-[#A33509] text-center py-0.5 cursor-pointer transition-colors"
          >
            New to the system? Read the full Enrollment Guide →
          </button>
        ) : (
          <p className="text-xs text-slate-400 text-center">
            Always verify current rules with your Regional Center.
          </p>
        )}
      </div>
    </div>
  );
}
