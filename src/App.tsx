import { useState, useMemo, useEffect } from 'react';

interface MapBounds {
  contains(point: [number, number]): boolean;
}
import HeroSection from './components/HeroSection';
import LocationFilter, { type ProgramSearchItem } from './components/LocationFilter';
import ProgramMap from './components/ProgramMap';
import ProgramGrid from './components/ProgramGrid';
import StateRegulatoryGuide from './components/StateRegulatoryGuide';
import RegionalCenterBanner from './components/RegionalCenterBanner';
import AboutPage from './components/AboutPage';
import { allPrograms } from './data/programs';
import { extractStateMap, extractCareTypes, filterPrograms } from './utils/programUtils';
import './index.css';

const stateMap = extractStateMap(allPrograms);
const careTypes = extractCareTypes(allPrograms);

const searchItems: ProgramSearchItem[] = allPrograms
  .filter(p => !!p.ccldLicenseNumber)
  .map(p => ({
    ccldLicenseNumber: p.ccldLicenseNumber!,
    displayName: p.streetName || p.legalLicenseName,
    legalName: p.legalLicenseName,
    city: p.location.city,
    county: p.location.county,
  }));

export default function App() {
  const selectedState = 'CA';
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedLaZip, setSelectedLaZip] = useState('');
  const [selectedCareType, setSelectedCareType] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [view, setView] = useState<'finder' | 'about'>('finder');
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const filtered = useMemo(() => {
    if (selectedProgramId) {
      return allPrograms.filter(p => p.ccldLicenseNumber === selectedProgramId);
    }
    return filterPrograms(allPrograms, selectedState, selectedCounty, selectedCareType, selectedLaZip || undefined);
  }, [selectedProgramId, selectedCounty, selectedCareType, selectedLaZip]);

  // Reset map bounds when the county/care-type filter changes so the new county
  // shows all its programs immediately (map re-fits and fires a fresh bounds update).
  useEffect(() => {
    setMapBounds(null);
  }, [selectedCounty, selectedLaZip, selectedCareType, selectedProgramId]);

  const listPrograms = useMemo(() => {
    if (!mapBounds || mapCollapsed) return filtered;
    return filtered.filter(p => {
      if (!p.location.coordinates) return true;
      const { lat, lng } = p.location.coordinates;
      return mapBounds.contains([lat, lng]);
    });
  }, [filtered, mapBounds, mapCollapsed]);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Top nav */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-11">
          <span className="font-ui font-semibold text-[#1E3A5F] text-sm tracking-wide">California Adult Day Program Finder</span>
          <div className="flex gap-1">
            {(['finder', 'about'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer font-ui ${
                  view === v
                    ? 'bg-[#FEF2EE] text-[#C2410C]'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                {v === 'finder' ? 'Find Programs' : 'About'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {view === 'about' ? (
        <AboutPage />
      ) : (
        <>
      <HeroSection
        selectedState={selectedState}
        selectedCounty={selectedCounty}
      />

      <LocationFilter
        counties={stateMap['CA'] ?? []}
        careTypes={careTypes}
        selectedCounty={selectedCounty}
        selectedLaZip={selectedLaZip}
        selectedCareType={selectedCareType}
        onCountyChange={(c) => { setSelectedCounty(c); setSelectedLaZip(''); }}
        onLaZipChange={setSelectedLaZip}
        onCareTypeChange={setSelectedCareType}
        totalResults={filtered.length}
        searchItems={searchItems}
        selectedProgramId={selectedProgramId}
        onProgramSelect={setSelectedProgramId}
        onProgramClear={() => setSelectedProgramId('')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <RegionalCenterBanner
          selectedState={selectedState}
          selectedCounty={selectedCounty}
          selectedLaZip={selectedLaZip}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-80 xl:w-96 shrink-0">
            <div className="lg:sticky lg:top-24 flex flex-col max-h-[calc(100vh-8rem)]">
              <StateRegulatoryGuide selectedCounty={selectedCounty} selectedLaZip={selectedLaZip} />
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <ProgramMap
              programs={filtered}
              compact
              collapsed={mapCollapsed}
              onCollapsedChange={setMapCollapsed}
              onBoundsChange={setMapBounds}
            />
            <ProgramGrid
              programs={listPrograms}
              totalFiltered={filtered.length}
              mapFilterActive={!mapCollapsed && !!mapBounds && listPrograms.length < filtered.length}
              selectedState={selectedState}
              selectedCounty={selectedCounty}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-200 bg-[#1E3A5F] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-display italic text-white/80 text-base">Exceptional Care Finder</span>
          <span className="font-ui text-sm text-white/50 flex items-center gap-1.5">
            <span className="text-amber-300">✨</span>
            AI-assisted summaries. Always verify directly with providers.
          </span>
        </div>
      </footer>
        </>
      )}
    </div>
  );
}
