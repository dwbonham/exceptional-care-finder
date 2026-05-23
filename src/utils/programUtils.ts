import type { ProgramData } from '../types';

export function extractStateMap(programs: ProgramData[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const p of programs) {
    const { state, county } = p.location;
    if (!map[state]) map[state] = new Set();
    if (county) map[state].add(county);
  }
  return Object.fromEntries(
    Object.entries(map).map(([state, counties]) => [
      state,
      Array.from(counties).sort(),
    ])
  );
}

export function extractCareTypes(programs: ProgramData[]): string[] {
  return Array.from(
    new Set(programs.map((p) => p.facilityDetails.decryptedProgramType))
  ).sort();
}

export function filterPrograms(
  programs: ProgramData[],
  selectedState: string,
  selectedCounty: string,
  selectedCareType: string
): ProgramData[] {
  return programs.filter((p) => {
    if (selectedState && p.location.state !== selectedState) return false;
    if (selectedCounty && p.location.county !== selectedCounty) return false;
    if (selectedCareType && p.facilityDetails.decryptedProgramType !== selectedCareType) return false;
    return true;
  });
}
