import type { FundingGuide } from '../../types';
import caGuideRaw from '../../../program-data/CA/funding-guide.json';

// To add a new state, import its funding-guide.json here and add it to the map.
// Example: import txGuideRaw from '../../../program-data/TX/funding-guide.json';

const fundingGuideMap: Record<string, FundingGuide> = {
  CA: caGuideRaw as FundingGuide,
};

export function getFundingGuide(state: string, county?: string): FundingGuide | null {
  const guide = fundingGuideMap[state];
  if (!guide) return null;

  // If a county is selected, narrow localAgencies to the matching one.
  // Falls back to all agencies if no county-specific match exists.
  if (county) {
    const matched = guide.localAgencies.filter((a) => a.county === county);
    return { ...guide, localAgencies: matched.length > 0 ? matched : guide.localAgencies };
  }

  return guide;
}
