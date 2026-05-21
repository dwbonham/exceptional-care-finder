import type { ProgramData } from '../types';
import ProgramCard from './ProgramCard';

interface Props {
  programs: ProgramData[];
}

export default function ProgramGrid({ programs }: Props) {
  if (programs.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-xl font-semibold text-slate-500">No programs loaded yet.</p>
        <p className="text-sm mt-2">Program data will appear here once populated.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500 font-medium">
          Showing{' '}
          <span className="text-slate-800 font-semibold">{programs.length}</span>{' '}
          programs in your area
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {programs.map((program, i) => (
          <ProgramCard key={i} program={program} />
        ))}
      </div>
    </div>
  );
}
