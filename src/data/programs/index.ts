import type { ProgramData } from '../../types';

// Auto-discovers every programs.json in program-data/ — no import needed when the pipeline adds new counties.
const modules = import.meta.glob<{ default: ProgramData[] }>(
  '../../../program-data/**/programs.json',
  { eager: true }
);

export const allPrograms: ProgramData[] = Object.values(modules).flatMap((m) => m.default);
