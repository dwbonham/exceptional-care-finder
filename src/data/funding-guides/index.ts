import type { FundingGuide } from '../../types';
import caGuideRaw from '../../../program-data/CA/funding-guide.json';

// To add a new state, import its funding-guide.json here and add it to the map.
// Example: import txGuideRaw from '../../../program-data/TX/funding-guide.json';

const fundingGuideMap: Record<string, FundingGuide> = {
  CA: caGuideRaw as FundingGuide,
};

export function getFundingGuide(state: string, zip?: string, county?: string): FundingGuide | null {
  const guide = fundingGuideMap[state];
  if (!guide) return null;

  if (zip && zip.length === 5) {
    const zipMatch = guide.localAgencies.filter((a) => a.zipCodes?.includes(zip));
    if (zipMatch.length > 0) return { ...guide, localAgencies: zipMatch };
    // Zip was given but not found — if this guide has zip-mapped agencies, return
    // empty rather than falling through to county match. Callers detect [] to show
    // a "zip not in our database" message instead of silently showing all agencies.
    if (guide.localAgencies.some((a) => a.zipCodes && a.zipCodes.length > 0)) {
      return { ...guide, localAgencies: [] };
    }
  }

  if (county) {
    // County match — agencies may list multiple counties as comma-separated string
    const countyMatch = guide.localAgencies.filter((a) => {
      if (!a.county) return false;
      return a.county.split(',').map((c) => c.trim()).includes(county);
    });
    // Return empty rather than all agencies when county provided but not mapped —
    // callers show a "contact DDS" fallback instead of a misleading full list.
    return { ...guide, localAgencies: countyMatch };
  }

  return guide;
}
