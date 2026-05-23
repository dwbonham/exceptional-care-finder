import { getFundingGuide } from '../data/funding-guides';

interface Props {
  selectedState: string;
  selectedZip: string;
  selectedCounty: string;
}

export default function RegionalCenterBanner({ selectedState, selectedZip, selectedCounty }: Props) {
  if (!selectedState) return null;

  const guide = getFundingGuide(selectedState, selectedZip || undefined, selectedCounty || undefined);
  if (!guide) return null;

  // When no zip selected, nudge the family to pick one
  if (!selectedZip) {
    return (
      <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-4 flex items-center gap-3">
        <span className="text-blue-400 text-lg shrink-0">📍</span>
        <p className="text-sm text-slate-600 leading-snug">
          Select a zip code above to see your local Regional Center — your first call for funding and eligibility.
        </p>
      </div>
    );
  }

  if (guide.localAgencies.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4">
        Your Local Regional Center · First point of contact for funding
      </p>
      <div className="flex flex-col sm:flex-row gap-6">
        {guide.localAgencies.map((agency, i) => (
          <div key={i} className="flex-1">
            <p className="text-base font-bold text-slate-900">{agency.name}</p>
            {agency.note && (
              <p className="text-sm text-slate-500 mt-0.5">{agency.note}</p>
            )}
            <div className="flex flex-wrap gap-5 mt-3">
              <a
                href={`tel:${agency.phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                📞 {agency.phone}
              </a>
              <a
                href={agency.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                🌐 Visit Website <span className="text-xs opacity-60">↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4 leading-relaxed">
        The Regional Center manages eligibility, approves your IPP, and coordinates state funding — call them before touring any programs.
      </p>
    </div>
  );
}
