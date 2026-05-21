import type { ProgramData } from '../../types';
import caRiversideRaw from '../../../program-data/CA/riverside/programs.json';

// To add a new county, import its programs.json and spread it in below.
// Example: import caLosAngelesRaw from '../../../program-data/CA/los-angeles/programs.json';

export const allPrograms: ProgramData[] = [
  ...(caRiversideRaw as ProgramData[]),
];
