import type { ProgramData } from '../../types';
import caRiversideRaw from './ca-riverside.json';

// To add a new county or state, import its JSON here and spread it into allPrograms.
// Example: import caLosAngelesRaw from './ca-losangeles.json';

export const allPrograms: ProgramData[] = [
  ...(caRiversideRaw as ProgramData[]),
];
