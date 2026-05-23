import { useState } from 'react';
import type { ProgramData } from '../types';
import ProgramCard from './ProgramCard';

const INITIAL_VISIBLE = 6;

interface Props {
  programs: ProgramData[];
  selectedState: string;
  selectedCounty: string;
}

export default function ProgramGrid({ programs, selectedState, selectedCounty }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (programs.length === 0) {
    const hasFilter = selectedState || selectedCounty;
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-5xl mb-4">{hasFilter ? '🗺️' : '🔍'}</p>
        <p className="text-xl font-semibold text-slate-500">
          {hasFilter ? 'No programs found for this location.' : 'No programs loaded yet.'}
        </p>
        <p className="text-sm mt-2">
          {hasFilter
            ? 'Try selecting a different state or county.'
            : 'Program data will appear here once populated.'}
        </p>
      </div>
    );
  }

  const visible = showAll ? programs : programs.slice(0, INITIAL_VISIBLE);
  const hidden = programs.length - INITIAL_VISIBLE;

  return (
    <div>
      {/* Count bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{visible.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{programs.length}</span> programs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visible.map((program, i) => (
          <ProgramCard key={i} program={program} />
        ))}
      </div>

      {/* Show more / collapse */}
      {programs.length > INITIAL_VISIBLE && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-colors duration-150 cursor-pointer"
          >
            {showAll ? (
              <>Show fewer programs <span className="text-slate-400">↑</span></>
            ) : (
              <>Show {hidden} more program{hidden !== 1 ? 's' : ''} <span className="text-slate-400">↓</span></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
