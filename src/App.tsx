import HeroSection from './components/HeroSection';
import ProgramGrid from './components/ProgramGrid';
import type { ProgramData } from './types';
import coronaPrograms from './data/coronaPrograms.json';
import './index.css';

const programs = coronaPrograms as ProgramData[];

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero / Header */}
      <HeroSection />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ProgramGrid programs={programs} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <span>
            © {new Date().getFullYear()} Exceptional Care Finder · Riverside County, CA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-violet-500">✨</span>
            AI-assisted program summaries. Always verify directly with providers.
          </span>
        </div>
      </footer>
    </div>
  );
}
