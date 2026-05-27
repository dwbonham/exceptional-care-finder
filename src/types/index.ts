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
  maximumAge?: number;
  yearEstablished?: number;
  languagesSupported?: string[];
  facilityFeatures?: string[];
  activitiesOffered?: string[];
  parentOrganization?: string;
  daysOfOperation?: string;
  hoursOfOperation?: string;
  selfDeterminationAccepted?: 'Yes' | 'No' | 'Unknown';
  populationSpecialization?: string[];
}

export interface VendorId {
  rc: string;
  id: string;
}

export interface ProgramFundingMechanics {
  vendorIds?: VendorId[];
  fundingSourceCategory: string;
  coveringAgencies: string[];
  authorizedServiceCodes: string[];
  transportationAvailability?: string;
  transportationServiceArea?: string;
  acceptsPrivatePay?: 'Yes' | 'No' | 'Unknown';
  requiredFundingDocument: string;
  financialCoverageNote: string;
}

export interface ProgramQualitativeInsights {
  parentReviews: string[];
}

export interface ProgramData {
  legalLicenseName: string;
  streetName: string;
  ccldLicenseNumber?: string;
  licenseStatus?: 'Active' | 'Inactive' | 'Revoked';
  licenseType?: string;
  location: ProgramLocation;
  contact: ProgramContact;
  facilityDetails: ProgramFacilityDetails;
  fundingMechanics: ProgramFundingMechanics;
  qualitativeInsights: ProgramQualitativeInsights;
  completenessScore?: number;
  lastVerifiedDate?: string;
  dataSourceNotes?: string;
}

// ─── Funding Guides ───────────────────────────────────────────────────────────

export interface LocalAgencyContact {
  county?: string;
  zipCodes?: string[];
  name: string;
  phone: string;
  websiteUrl: string;
  note?: string;
}

export interface EnrollmentSource {
  label: string;
  url: string;
}

export interface EnrollmentBlock {
  type: 'paragraph' | 'bullets' | 'steps' | 'note' | 'questions' | 'resources';
  text?: string;
  heading?: string;
  items?: string[] | EnrollmentSource[];
  groups?: Array<{ heading: string; questions: string[] }>;
}

export interface EnrollmentSection {
  title: string;
  blocks: EnrollmentBlock[];
  sources?: EnrollmentSource[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  category?: string;
}

export interface FundingGuide {
  state: string;
  title: string;
  localAgencies: LocalAgencyContact[];
  enrollmentGuide: EnrollmentSection[];
  glossary?: GlossaryTerm[];
  careTypeDefinitions?: GlossaryTerm[];
}
