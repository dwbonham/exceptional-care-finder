# Data Entry Templates

These schema templates are used for **manual data entry** — giving Gemini a structured format to follow when researching programs for a new county or state.

> **Note:** For California counties, an automated pipeline is being built that will replace this manual process. These templates remain useful for: (1) adding new states, (2) reviewing flagged programs that the pipeline couldn't auto-enrich, and (3) understanding the data schema.

---

## How to Add a New County Manually

1. Give Gemini `programs.json` from this folder (the schema)
2. Give Gemini an existing real example: `program-data/CA/riverside/programs.json`
3. Ask: *"Using this schema and example, research and build a complete programs.json for [County], [State]"*
4. Save the result to `program-data/[STATE]/[county]/programs.json`
5. Tell Claude Code: *"Wire in the new [County], [State] programs file"*

## How to Add a New State's Funding Guide

1. Give Gemini `funding-guide.json` from this folder
2. Ask: *"Using this schema, research the funding and eligibility rules for developmental disability day programs in [State] and build a funding-guide.json"*
3. Save to `program-data/[STATE]/funding-guide.json`
4. Tell Claude Code: *"Wire in the new [State] funding guide"*

---

## Valid Values for Key Fields

**decryptedProgramType** (use exactly one):
- `Adult Development Center`
- `Adult Development Center (Vocational)`
- `Behavior Management Program`
- `Community Integration Program`
- `Supported Employment`

**facilityFeatures** (use any combination):
- `Wheelchair Accessible`
- `Sensory-Friendly`
- `Behavioral Support Spaces`
- `Vocational Workshop`
- `On-site Therapies`
- `Outdoor Space`

**authorizedServiceCodes** (CA only — note: use array format, programs may have more than one):
- `"510"` — Adult Development Center
- `"515"` — Behavior Management Program
- `"517"` — Community Integration Program

**selfDeterminationAccepted:**
- `"Yes"` / `"No"` / `"Unknown"`

**licenseStatus:**
- `"Active"` / `"Inactive"` / `"Revoked"`

---

## Schema Changes Coming with the Pipeline

The schema is being updated to support the automated CA pipeline. Key changes:
- `stateBillingCode: string` → `authorizedServiceCodes: string[]` (array, multiple codes allowed)
- `localAdministeringAgency: string` → `coveringAgencies: string[]` (array, for multi-RC counties)
- `vendorId?: string` → `vendorIds?: { rc: string; id: string }[]`
- New fields added: `ccldLicenseNumber`, `licenseStatus`, `licenseType`, `parentOrganization`, `daysOfOperation`, `hoursOfOperation`, `selfDeterminationAccepted`, `populationSpecialization`

When the pipeline is live, Claude Code will update these templates to match the new schema.
