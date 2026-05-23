import type { ProgramData } from '../types';

export interface ZipEntry {
  zip: string;
  county: string;
}

export function extractZipMap(programs: ProgramData[]): Record<string, ZipEntry[]> {
  const map: Record<string, Map<string, string>> = {};
  for (const p of programs) {
    const { state, zipCode, county } = p.location;
    if (!map[state]) map[state] = new Map();
    map[state].set(zipCode, county);
  }
  return Object.fromEntries(
    Object.entries(map).map(([state, zipMap]) => [
      state,
      Array.from(zipMap.entries())
        .map(([zip, county]) => ({ zip, county }))
        .sort((a, b) => a.zip.localeCompare(b.zip)),
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
  selectedZip: string,
  selectedCareType: string
): ProgramData[] {
  return programs.filter((p) => {
    if (selectedState && p.location.state !== selectedState) return false;
    if (selectedZip && p.location.zipCode !== selectedZip) return false;
    if (selectedCareType && p.facilityDetails.decryptedProgramType !== selectedCareType) return false;
    return true;
  });
}
