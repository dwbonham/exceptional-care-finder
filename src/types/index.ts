// ─── Program Data ────────────────────────────────────────────────────────────

export interface ProgramCoordinates {
  lat: number;
  lng: number;
}

export interface ProgramLocation {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  coordinates?: ProgramCoordinates;
}

export interface ProgramContact {
  phone: string;
  websiteUrl: string;
}

export interface ProgramFacilityDetails {
  licensedCapacity: number | string;
  decryptedProgramType: string;
  programFocus: string;
  minimumAge?: number;
  languagesSupported?: string[];
  facilityFeatures?: string[];
}

export interface ProgramFundingMechanics {
  vendorId?: string;
  fundingSourceCategory: string;
  localAdministeringAgency: string;
  stateBillingCode: string;
  transportationAvailability?: string;
  requiredFundingDocument: string;
  financialCoverageNote: string;
}

export interface ProgramQualitativeInsights {
  parentReviews: string[];
}

export type AvailabilityStatus = 'Accepting' | 'Waitlist' | 'Closed';

export interface ProgramData {
  legalLicenseName: string;
  streetName: string;
  location: ProgramLocation;
  contact: ProgramContact;
  facilityDetails: ProgramFacilityDetails;
  fundingMechanics: ProgramFundingMechanics;
  currentAvailabilityStatus?: AvailabilityStatus;
  qualitativeInsights: ProgramQualitativeInsights;
}

// ─── Funding Guides ───────────────────────────────────────────────────────────

export interface LocalAgencyContact {
  county: string;
  name: string;
  phone: string;
  websiteUrl: string;
  note?: string;
}

export interface FundingGuideFaq {
  question: string;
  answer: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface AvailabilityStatusDefinitions {
  Accepting: string;
  Waitlist: string;
  Closed: string;
}

export interface FundingGuide {
  state: string;
  title: string;
  localAgencies: LocalAgencyContact[];
  availabilityTracking?: { statusDefinitions: AvailabilityStatusDefinitions };
  faqs: FundingGuideFaq[];
}
