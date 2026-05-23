interface Props {
  stateMap: Record<string, string[]>;
  careTypes: string[];
  selectedState: string;
  selectedCounty: string;
  selectedLaZip: string;
  selectedCareType: string;
  onStateChange: (state: string) => void;
  onCountyChange: (county: string) => void;
  onLaZipChange: (zip: string) => void;
  onCareTypeChange: (careType: string) => void;
  totalResults: number;
}

const SELECT_CLASS =
  'w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

function Chevron() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
      ▾
    </span>
  );
}

const isLaCounty = (state: string, county: string) =>
  state === 'CA' && county === 'Los Angeles';

export default function LocationFilter({
  stateMap,
  careTypes,
  selectedState,
  selectedCounty,
  selectedLaZip,
  selectedCareType,
  onStateChange,
  onCountyChange,
  onLaZipChange,
  onCareTypeChange,
  totalResults,
}: Props) {
  const states = Object.keys(stateMap).sort();
  const counties = selectedState ? (stateMap[selectedState] ?? []) : [];
  const showLaZip = isLaCounty(selectedState, selectedCounty);
  const hasFilter = selectedState || selectedCounty || selectedCareType;

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onStateChange(e.target.value);
    onCountyChange('');
    onLaZipChange('');
  }

  function handleCountyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onCountyChange(e.target.value);
    onLaZipChange('');
  }

  function clearAll() {
    onStateChange('');
    onCountyChange('');
    onLaZipChange('');
    onCareTypeChange('');
  }

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Filter dropdowns */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1">

            {/* Location group */}
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 min-w-0">
                <select value={selectedState} onChange={handleStateChange} className={SELECT_CLASS}>
                  <option value="">All States</option>
                  {states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Chevron />
              </div>

              <div className="relative flex-1 min-w-0">
                <select
                  value={selectedCounty}
                  onChange={handleCountyChange}
                  disabled={!selectedState}
                  className={SELECT_CLASS}
                >
                  <option value="">{selectedState ? 'All Counties' : 'County'}</option>
                  {counties.map((c) => (
                    <option key={c} value={c}>{c} County</option>
                  ))}
                </select>
                <Chevron />
              </div>
            </div>

            {/* LA County ZIP refinement — only shows for Los Angeles County */}
            {showLaZip && (
              <div className="relative sm:w-44">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="ZIP (optional)"
                  value={selectedLaZip}
                  onChange={(e) => onLaZipChange(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-slate-400"
                />
              </div>
            )}

            {/* Divider */}
            <div className="hidden sm:block w-px bg-slate-200 self-stretch" />

            {/* Care type */}
            <div className="relative sm:w-64">
              <select
                value={selectedCareType}
                onChange={(e) => onCareTypeChange(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">All Care Types</option>
                {careTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Chevron />
            </div>
          </div>

          {/* Right side: clear + count */}
          <div className="flex items-center gap-3 shrink-0">
            {hasFilter && (
              <button
                onClick={clearAll}
                className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Clear all
              </button>
            )}
            <span className="text-sm text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-700">{totalResults}</span>{' '}
              {totalResults === 1 ? 'program' : 'programs'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
