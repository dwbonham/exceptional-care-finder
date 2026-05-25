import { getFundingGuide } from '../data/funding-guides';

interface Props {
  selectedState: string;
  selectedCounty: string;
  selectedLaZip: string;
}

const isLaCounty = (state: string, county: string) =>
  state === 'CA' && county === 'Los Angeles';

export default function RegionalCenterBanner({ selectedState, selectedCounty, selectedLaZip }: Props) {
  // Only show once a county is selected
  if (!selectedState || !selectedCounty) return null;

  const guide = getFundingGuide(selectedState, selectedLaZip || undefined, selectedCounty);
  const laMode = isLaCounty(selectedState, selectedCounty);
  const laZipNotFound = laMode && selectedLaZip.length === 5 && guide?.localAgencies.length === 0;

  // When zip not found, fall back to showing all LA agencies with a warning
  const allLaGuide = laZipNotFound ? getFundingGuide(selectedState, undefined, selectedCounty) : null;
  const displayGuide = laZipNotFound ? allLaGuide : guide;

  // County selected but no RC mapped — show DDS contact rather than nothing
  if (!displayGuide || displayGuide.localAgencies.length === 0) {
    if (selectedCounty && !laMode) {
      return (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
          <p className="text-sm font-semibold text-amber-700 mb-1">Regional Center Contact</p>
          <p className="text-sm text-amber-600 leading-relaxed">
            We don't have a Regional Center mapped for {selectedCounty} County yet.
            Call California DDS at{' '}
            <a href="tel:8334210061" className="underline font-semibold">(833) 421-0061</a>
            {' '}to find your local center.
          </p>
        </div>
      );
    }
    return null;
  }

  const narrowed = laMode && selectedLaZip.length === 5 && !laZipNotFound && displayGuide.localAgencies.length < 7;

  return (
    <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">
        {narrowed
          ? 'Your Local Regional Center · First point of contact for funding'
          : laMode
            ? 'Los Angeles County Regional Centers · 7 centers serve different communities'
            : 'Your Local Regional Center · First point of contact for funding'}
      </p>

      {/* LA County ZIP nudge when no ZIP entered yet */}
      {laMode && !selectedLaZip && (
        <p className="text-sm text-slate-500 mb-4">
          Enter your ZIP code in the filter above to identify which center serves your area.
        </p>
      )}

      {/* ZIP entered but not in our database */}
      {laZipNotFound && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 mt-2 leading-relaxed">
          ZIP {selectedLaZip} isn't in our coverage map yet. Showing all LA Regional Centers — call DDS at (833) 421-0061 to confirm which serves you.
        </p>
      )}

      <div className="flex flex-col gap-4 mt-3">
        {displayGuide.localAgencies.map((agency, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
            <div className="flex-1">
              <p className="text-base font-bold text-slate-900">{agency.name}</p>
              {agency.note && (
                <p className="text-sm text-slate-500 mt-0.5 leading-snug">{agency.note}</p>
              )}
              <div className="flex flex-wrap gap-5 mt-2">
                <a
                  href={`tel:${agency.phone.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <span aria-hidden="true">📞</span> {agency.phone}
                </a>
                <a
                  href={agency.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <span aria-hidden="true">🌐</span> Visit Website <span className="text-xs opacity-60">↗</span>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4 leading-relaxed">
        {laMode && (!narrowed || laZipNotFound)
          ? 'LA County Regional Center assignment is based on your city of residence. Call DDS at (833) 421-0061 to confirm your assigned center.'
          : 'The Regional Center manages eligibility, approves your IPP, and coordinates state funding — call them before touring any programs.'}
      </p>
    </div>
  );
}
