import type { ProgramData } from '../types';
import ProgramCard from './ProgramCard';

interface Props {
  programs: ProgramData[];
  selectedState: string;
  selectedCounty: string;
}

export default function ProgramGrid({ programs, selectedState, selectedCounty }: Props) {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {programs.map((program, i) => (
        <ProgramCard key={i} program={program} />
      ))}
    </div>
  );
}
