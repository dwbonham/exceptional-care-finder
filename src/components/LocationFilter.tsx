import { useState, useRef, useEffect } from 'react';

export interface ProgramSearchItem {
  ccldLicenseNumber: string;
  displayName: string;
  legalName: string;
  city: string;
  county: string;
}

interface Props {
  counties: string[];
  careTypes: string[];
  selectedCounty: string;
  selectedLaZip: string;
  selectedCareType: string;
  onCountyChange: (county: string) => void;
  onLaZipChange: (zip: string) => void;
  onCareTypeChange: (careType: string) => void;
  totalResults: number;
  searchItems: ProgramSearchItem[];
  selectedProgramId: string;
  onProgramSelect: (id: string) => void;
  onProgramClear: () => void;
}

const SELECT_CLASS =
  'w-full appearance-none bg-[#EFF4FA] border border-[#1E3A5F]/15 rounded-xl px-4 py-2.5 pr-9 text-sm font-ui font-medium text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/25 focus:border-[#1E3A5F] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

function Chevron() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
      ▾
    </span>
  );
}

function ProgramSearchBox({
  items,
  selectedId,
  onSelect,
  onClear,
  disabled,
}: {
  items: ProgramSearchItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.toLowerCase();
  const results = q.length < 1 ? [] : items
    .filter(item =>
      item.displayName.toLowerCase().includes(q) ||
      item.legalName.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q)
    )
    .slice(0, 10);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0 && results[cursor]) {
      e.preventDefault();
      onSelect(results[cursor].ccldLicenseNumber);
      setQuery('');
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (selectedId) {
    const found = items.find(i => i.ccldLicenseNumber === selectedId);
    return (
      <div className="flex items-center gap-2 bg-[#FEF2EE] border border-[#C2410C]/25 rounded-xl px-3 py-2.5 text-sm font-ui">
        <span className="text-[#C2410C] shrink-0">🔍</span>
        <span className="font-medium text-[#1E3A5F] truncate flex-1 min-w-0">
          {found?.displayName ?? 'Selected program'}
        </span>
        <button
          onClick={onClear}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-base leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by program or org name…"
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full bg-[#EFF4FA] border border-[#1E3A5F]/15 rounded-xl pl-9 pr-4 py-2.5 text-sm font-ui font-medium text-[#1E3A5F] placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/25 focus:border-[#1E3A5F] disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
          {results.map((item, i) => {
            const showLegal = item.legalName !== item.displayName;
            return (
              <button
                key={item.ccldLicenseNumber}
                onMouseDown={e => { e.preventDefault(); onSelect(item.ccldLicenseNumber); setQuery(''); setOpen(false); }}
                onMouseEnter={() => setCursor(i)}
                className={`w-full text-left px-4 py-2.5 cursor-pointer transition-colors ${
                  cursor === i ? 'bg-[#EFF4FA]' : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-sm text-[#1E3A5F] truncate">{item.displayName}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {item.city}, {item.county} County
                  {showLegal && <span className="ml-1.5 text-slate-300">· {item.legalName}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && query.length >= 1 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 px-4 py-3 text-sm text-slate-400">
          No programs found for "{query}"
        </div>
      )}
    </div>
  );
}

export default function LocationFilter({
  counties,
  careTypes,
  selectedCounty,
  selectedLaZip,
  selectedCareType,
  onCountyChange,
  onLaZipChange,
  onCareTypeChange,
  totalResults,
  searchItems,
  selectedProgramId,
  onProgramSelect,
  onProgramClear,
}: Props) {
  const showLaZip = selectedCounty === 'Los Angeles' && !selectedProgramId;
  const filtersDisabled = !!selectedProgramId;
  const hasFilter = selectedCounty || selectedCareType || selectedProgramId;

  function handleCountyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onCountyChange(e.target.value);
    onLaZipChange('');
  }

  function clearAll() {
    onCountyChange('');
    onLaZipChange('');
    onCareTypeChange('');
    onProgramClear();
  }

  return (
    <div className="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col gap-2">

          {/* Search row */}
          <div className="flex items-center gap-2">
            <ProgramSearchBox
              items={searchItems}
              selectedId={selectedProgramId}
              onSelect={onProgramSelect}
              onClear={onProgramClear}
              disabled={false}
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className={`flex flex-col sm:flex-row gap-2 flex-1 transition-opacity ${filtersDisabled ? 'opacity-40 pointer-events-none' : ''}`}>

              {/* Location group */}
              <div className="flex gap-2 flex-1">
                <div className="flex items-center px-4 py-2.5 bg-[#1E3A5F] rounded-xl text-sm font-ui font-semibold text-white whitespace-nowrap shrink-0">
                  California
                </div>

                <div className="relative flex-1 min-w-0">
                  <select
                    value={selectedCounty}
                    onChange={handleCountyChange}
                    disabled={filtersDisabled}
                    className={SELECT_CLASS}
                  >
                    <option value="">All Counties</option>
                    {counties.map((c) => (
                      <option key={c} value={c}>{c} County</option>
                    ))}
                  </select>
                  <Chevron />
                </div>
              </div>

              {/* LA County ZIP refinement */}
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
                  disabled={filtersDisabled}
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
              <span className="font-ui text-sm text-stone-400 whitespace-nowrap">
                <span className="font-semibold text-[#C2410C]">{totalResults}</span>{' '}
                {totalResults === 1 ? 'program' : 'programs'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
