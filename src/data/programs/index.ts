import type { ProgramData } from '../../types';
import caRiversideRaw from '../content/CA/riverside/programs.json';

// To add a new county, import its programs.json and spread it in below.
// Example: import caLosAngelesRaw from '../content/CA/los-angeles/programs.json';

export const allPrograms: ProgramData[] = [
  ...(caRiversideRaw as ProgramData[]),
];
