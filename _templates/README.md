# Data Templates

These two files are schema templates. Give them to Gemini (or any AI) when asking it to research and build a new county or state's data.

## How to use

**For a new county's programs:**
1. Give Gemini `programs.json` from this folder
2. Give Gemini an existing real example (e.g., `src/data/content/CA/riverside/programs.json`)
3. Ask: "Using this schema and example, research and build a complete programs.json for [County], [State]"
4. Save the result to `src/data/content/[STATE]/[county]/programs.json`
5. Tell Claude Code: "Wire in the new [County], [State] programs file"

**For a new state's funding guide:**
1. Give Gemini `funding-guide.json` from this folder
2. Ask: "Using this schema, research the funding and eligibility rules for developmental disability day programs in [State] and build a funding-guide.json"
3. Save to `src/data/content/[STATE]/funding-guide.json`
4. Tell Claude Code: "Wire in the new [State] funding guide"

## Valid values for key fields

**decryptedProgramType** (use exactly one of these):
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

**stateBillingCode** (CA only):
- `510` — Adult Development Center
- `515` — Behavior Management Program
