import { useState } from 'react';
import HeroSection from './components/HeroSection';
import LocationFilter from './components/LocationFilter';
import ProgramMap from './components/ProgramMap';
import ProgramGrid from './components/ProgramGrid';
import StateRegulatoryGuide from './components/StateRegulatoryGuide';
import RegionalCenterBanner from './components/RegionalCenterBanner';
import { allPrograms } from './data/programs';
import { extractStateMap, extractCareTypes, filterPrograms } from './utils/programUtils';
import './index.css';

const stateMap = extractStateMap(allPrograms);
const careTypes = extractCareTypes(allPrograms);

export default function App() {
  const [selectedState, setSelectedState] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedLaZip, setSelectedLaZip] = useState('');
  const [selectedCareType, setSelectedCareType] = useState('');

  const filtered = filterPrograms(allPrograms, selectedState, selectedCounty, selectedCareType);

  return (
    <div className="min-h-screen bg-slate-50">
      <HeroSection
        selectedState={selectedState}
        selectedCounty={selectedCounty}
      />

      <LocationFilter
        stateMap={stateMap}
        careTypes={careTypes}
        selectedState={selectedState}
        selectedCounty={selectedCounty}
        selectedLaZip={selectedLaZip}
        selectedCareType={selectedCareType}
        onStateChange={(s) => { setSelectedState(s); setSelectedCounty(''); setSelectedLaZip(''); }}
        onCountyChange={(c) => { setSelectedCounty(c); setSelectedLaZip(''); }}
        onLaZipChange={setSelectedLaZip}
        onCareTypeChange={setSelectedCareType}
        totalResults={filtered.length}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <ProgramMap programs={filtered} />
        </div>

        <RegionalCenterBanner
          selectedState={selectedState}
          selectedCounty={selectedCounty}
          selectedLaZip={selectedLaZip}
        />

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-80 xl:w-96 shrink-0">
            <div className="lg:sticky lg:top-24">
              <StateRegulatoryGuide selectedState={selectedState} />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <ProgramGrid
              programs={filtered}
              selectedState={selectedState}
              selectedCounty={selectedCounty}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Exceptional Care Finder · Nationwide</span>
          <span className="flex items-center gap-1.5">
            <span className="text-violet-500">✨</span>
            AI-assisted program summaries. Always verify directly with providers.
          </span>
        </div>
      </footer>
    </div>
  );
}
