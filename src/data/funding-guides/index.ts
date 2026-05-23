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

  if (zip) {
    // Zip-specific match first (handles LA County multi-RC case)
    const zipMatch = guide.localAgencies.filter((a) => a.zipCodes?.includes(zip));
    if (zipMatch.length > 0) return { ...guide, localAgencies: zipMatch };
  }

  if (county) {
    // County fallback (for agencies without explicit zipCodes)
    const countyMatch = guide.localAgencies.filter((a) => a.county === county);
    if (countyMatch.length > 0) return { ...guide, localAgencies: countyMatch };
  }

  return guide;
}
