#!/usr/bin/env bun
// One-time script: populates the Regional Centers tab in Google Sheets with
// all 21 California Regional Centers.
//
// Usage:
//   GOOGLE_SHEET_ID=<id> GOOGLE_SERVICE_ACCOUNT_PATH=<path> bun scripts/pipeline/populate-regional-centers.js
//
// Or trigger via: .github/workflows/populate-rc.yml (workflow_dispatch)

import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fundingGuide = JSON.parse(
  readFileSync(join(__dirname, '../../program-data/CA/funding-guide.json'), 'utf8')
);

// Build a map from RC name → zip array for quick lookup
const zipsByRcName = Object.fromEntries(
  fundingGuide.localAgencies
    .filter(a => a.zipCodes && a.zipCodes.length > 0)
    .map(a => [a.name, a.zipCodes])
);

const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const SA_PATH    = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
const SHEET_NAME = 'Regional Centers';

if (!SHEET_ID || !SA_PATH) {
  console.error('Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_PATH');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf8'));

// ─── Column definitions ───────────────────────────────────────────────────────

const HEADERS = [
  'State',
  'RC Name',
  'Short Name',
  'Phone',
  'Website',
  'Full Counties Served',
  'Partial County',           // county where coverage is by city, not full county (e.g. "Los Angeles")
  'Service Area (Cities)',    // for LA County RCs — cities/neighborhoods served
  'Zip Routing Note',         // placeholder for future zip→RC lookup
  'Address',
  'Verify',                   // flag rows where phone/website needs confirmation
  'Notes',
];

// ─── All 21 California Regional Centers ──────────────────────────────────────
// Sources: CA DDS, individual RC websites (as of 2025).
// Phone numbers and websites marked (verify) should be confirmed before
// using in production — RC contact info changes periodically.

const REGIONAL_CENTERS = [
  // ── Northern California ──────────────────────────────────────────────────
  {
    state:        'CA',
    name:         'Alta California Regional Center',
    short:        'Alta California RC',
    phone:        '(916) 978-6400',
    website:      'https://www.altaregional.org',
    counties:     'Sacramento, Placer, El Dorado, Yolo, Nevada, Sierra, Plumas',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '2241 Harvard Street, Suite 100, Sacramento, CA 95815',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Far Northern Regional Center',
    short:        'Far Northern RC',
    phone:        '(530) 222-4791',
    website:      'https://www.fnrc.org',
    counties:     'Butte, Glenn, Lassen, Modoc, Shasta, Siskiyou, Tehama, Trinity',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '1900 Churn Creek Road, Suite 150, Redding, CA 96002',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Redwood Coast Regional Center',
    short:        'Redwood Coast RC',
    phone:        '(707) 445-0893',
    website:      'https://www.redwoodcoast.org',
    counties:     'Del Norte, Humboldt, Lake, Mendocino, Trinity',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '525 2nd Street, Eureka, CA 95501',
    verify:       'verify',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'North Bay Regional Center',
    short:        'North Bay RC',
    phone:        '(707) 256-1100',
    website:      'https://www.nbrc.net',
    counties:     'Napa, Solano',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '61 Airport Boulevard, Suite 200, Santa Rosa, CA 95403',
    verify:       'verify',
    notes:        'Also has offices in Fairfield and Napa',
  },
  {
    state:        'CA',
    name:         'Golden Gate Regional Center',
    short:        'Golden Gate RC',
    phone:        '(415) 546-9222',
    website:      'https://www.ggrc.org',
    counties:     'San Francisco, Marin, San Mateo',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '1221 Mission Street, San Francisco, CA 94103',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Regional Center of the East Bay',
    short:        'East Bay RC',
    phone:        '(510) 383-1200',
    website:      'https://www.rceb.org',
    counties:     'Alameda, Contra Costa',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '500 Davis Street, Suite 100, San Leandro, CA 94577',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Valley Mountain Regional Center',
    short:        'Valley Mountain RC',
    phone:        '(209) 473-0951',
    website:      'https://www.vmrc.net',
    counties:     'Amador, Calaveras, San Joaquin, Stanislaus, Tuolumne',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '702 N. Aurora Street, Stockton, CA 95202',
    verify:       '',
    notes:        '',
  },

  // ── Central California ───────────────────────────────────────────────────
  {
    state:        'CA',
    name:         'San Andreas Regional Center',
    short:        'San Andreas RC',
    phone:        '(408) 374-9960',
    website:      'https://www.sarc.org',
    counties:     'Santa Clara, Santa Cruz, San Benito, Monterey',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '6th & B Streets, Hayward, CA 94541',
    verify:       'verify',
    notes:        'Headquarters in Campbell; verify current address',
  },
  {
    state:        'CA',
    name:         'Central Valley Regional Center',
    short:        'Central Valley RC',
    phone:        '(559) 276-4300',
    website:      'https://www.cvrc.org',
    counties:     'Fresno, Kings, Madera, Tulare',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '4615 N. Marty Avenue, Fresno, CA 93722',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Kern Regional Center',
    short:        'Kern RC',
    phone:        '(661) 327-0071',
    website:      'https://www.kern.org',
    counties:     'Inyo, Kern, Mono',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '3200 North Sillect Avenue, Bakersfield, CA 93308',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Tri-Counties Regional Center',
    short:        'Tri-Counties RC',
    phone:        '(805) 962-7881',
    website:      'https://www.tri-counties.org',
    counties:     'San Luis Obispo, Santa Barbara, Ventura',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '520 East Montecito Street, Santa Barbara, CA 93103',
    verify:       '',
    notes:        '',
  },

  // ── Southern California ──────────────────────────────────────────────────
  {
    state:        'CA',
    name:         'Inland Regional Center',
    short:        'Inland RC',
    phone:        '(909) 890-3000',
    website:      'https://www.inlandrc.org',
    counties:     'Riverside, San Bernardino',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '674 Brier Drive, San Bernardino, CA 92408',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Regional Center of Orange County',
    short:        'Orange County RC',
    phone:        '(714) 796-5100',
    website:      'https://www.rcoc.org',
    counties:     'Orange',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '1525 North Tustin Avenue, Santa Ana, CA 92705',
    verify:       'verify',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'San Diego Regional Center',
    short:        'San Diego RC',
    phone:        '(619) 685-1500',
    website:      'https://www.sdrc.org',
    counties:     'Imperial, San Diego',
    partialCounty: '',
    cities:       '',
    zipNote:      '',
    address:      '4355 Ruffin Road, San Diego, CA 92123',
    verify:       'verify',
    notes:        '',
  },

  // ── Los Angeles County (7 RCs) ───────────────────────────────────────────
  // Zip codes sourced from program-data/CA/funding-guide.json (authoritative).
  // Boundaries follow LA County health districts; some boundary zips may
  // straddle two RCs — call DDS (833) 421-0061 to confirm.
  {
    state:        'CA',
    name:         'Frank D. Lanterman Regional Center',
    short:        'Lanterman RC',
    phone:        '(818) 246-5200',
    website:      'https://www.lanterman.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Alhambra, Arcadia, Burbank, Duarte, El Monte, Glendale, La Cañada Flintridge, Monrovia, Montebello, Monterey Park, Pasadena, Rosemead, San Gabriel, San Marino, Sierra Madre, Temple City',
    zipNote:      (zipsByRcName['Frank D. Lanterman Regional Center'] ?? []).join(', '),
    address:      '3303 Wilshire Boulevard, Suite 700, Los Angeles, CA 90010',
    verify:       '',
    notes:        'Serves central/northeast corridor of LA County',
  },
  {
    state:        'CA',
    name:         'North Los Angeles County Regional Center',
    short:        'North LA County RC',
    phone:        '(818) 778-1900',
    website:      'https://www.nlacrc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Agoura Hills, Burbank (partial), Calabasas, Canoga Park, Chatsworth, Encino, Granada Hills, Lancaster, Northridge, Palmdale, Reseda, San Fernando, Sylmar, Tarzana, Van Nuys, West Hills, Westlake Village, Woodland Hills',
    zipNote:      (zipsByRcName['North Los Angeles County Regional Center'] ?? []).join(', '),
    address:      '9200 Oakdale Avenue, Chatsworth, CA 91311',
    verify:       '',
    notes:        'Serves San Fernando Valley and Antelope Valley communities',
  },
  {
    state:        'CA',
    name:         'Eastern Los Angeles Regional Center',
    short:        'East LA RC',
    phone:        '(323) 838-4750',
    website:      'https://www.elarc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Azusa, Baldwin Park, Bell, Bell Gardens, Boyle Heights, Commerce, East Los Angeles, Hacienda Heights, Irwindale, La Puente, Maywood, Pico Rivera, Rowland Heights, South El Monte, Walnut, Whittier',
    zipNote:      (zipsByRcName['Eastern Los Angeles Regional Center'] ?? []).join(', '),
    address:      '1000 South Fremont Avenue, Building A-9, Alhambra, CA 91803',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'San Gabriel/Pomona Valley Regional Center',
    short:        'San Gabriel RC',
    phone:        '(909) 620-7722',
    website:      'https://www.sgprc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Altadena, Arcadia (partial), Claremont, Duarte, El Monte, Glendora, Hacienda Heights, La Puente, Monrovia, Pomona, Rowland Heights, Sierra Madre, Walnut, West Covina',
    zipNote:      (zipsByRcName['San Gabriel/Pomona Valley Regional Center'] ?? []).join(', '),
    address:      '75 Rancho Santa Anita Drive, Suite A, Arcadia, CA 91006',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'South Central Los Angeles Regional Center',
    short:        'South Central LA RC',
    phone:        '(213) 744-7000',
    website:      'https://www.sclarc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Athens, Bell, Compton, Crenshaw, Cudahy, Florence, Hyde Park, Leimert Park, Lynwood, Maywood, South Central LA, South Gate, Vernon, Watts',
    zipNote:      (zipsByRcName['South Central Los Angeles Regional Center'] ?? []).join(', '),
    address:      '650 West Adams Boulevard, Los Angeles, CA 90007',
    verify:       '',
    notes:        '',
  },
  {
    state:        'CA',
    name:         'Harbor Regional Center',
    short:        'Harbor RC',
    phone:        '(310) 540-1711',
    website:      'https://www.harborrc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Artesia, Bellflower, Carson, Cerritos, El Segundo, Gardena, Hawthorne, Hermosa Beach, Lakewood, Lawndale, Lomita, Long Beach, Manhattan Beach, Norwalk, Palos Verdes Estates, Rancho Palos Verdes, Redondo Beach, Rolling Hills, San Pedro, Signal Hill, Torrance, Wilmington',
    zipNote:      (zipsByRcName['Harbor Regional Center'] ?? []).join(', '),
    address:      '21231 Hawthorne Boulevard, Torrance, CA 90503',
    verify:       '',
    notes:        'Serves the South Bay peninsula and Harbor communities',
  },
  {
    state:        'CA',
    name:         'Westside Regional Center',
    short:        'Westside RC',
    phone:        '(310) 258-4000',
    website:      'https://www.westsiderc.org',
    counties:     '',
    partialCounty: 'Los Angeles',
    cities:       'Bel-Air, Beverly Hills, Brentwood, Century City, Culver City, Inglewood, Malibu, Marina del Rey, Pacific Palisades, Playa del Rey, Santa Monica, Venice, West Hollywood, West Los Angeles, Westwood',
    zipNote:      (zipsByRcName['Westside Regional Center'] ?? []).join(', '),
    address:      '11600 Wilshire Boulevard, Suite 800, Los Angeles, CA 90025',
    verify:       '',
    notes:        'Serves the coastal and west side communities of LA County',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Authenticating with Google Sheets…');
  const token = await getAccessToken(serviceAccount);

  console.log(`Ensuring "${SHEET_NAME}" tab exists…`);
  await ensureTab(SHEET_ID, SHEET_NAME, token);

  console.log('Clearing existing data…');
  await clearSheet(SHEET_ID, SHEET_NAME, token);

  console.log(`Writing ${REGIONAL_CENTERS.length} regional centers…`);
  const rows = [
    HEADERS,
    ...REGIONAL_CENTERS.map(rc => [
      rc.state,
      rc.name,
      rc.short,
      rc.phone,
      rc.website,
      rc.counties,
      rc.partialCounty,
      rc.cities,
      rc.zipNote,
      rc.address,
      rc.verify,
      rc.notes,
    ]),
  ];

  await appendRows(SHEET_ID, SHEET_NAME, rows, token);
  console.log(`Done. ${REGIONAL_CENTERS.length} rows written to "${SHEET_NAME}" tab.`);
  console.log('\nNote: rows marked "verify" in column K should have phone/website confirmed.');
  console.log('Note: LA County "Service Area (Cities)" columns are approximate — boundaries');
  console.log('      between some RCs are determined by city of residence and should be');
  console.log('      confirmed at dds.ca.gov/services/regional-centers/find-your-rc/');
}

// ─── Sheets helpers ───────────────────────────────────────────────────────────

async function ensureTab(spreadsheetId, sheetName, token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    }
  );
  if (!res.ok) {
    const data = await res.json();
    if (!data?.error?.message?.includes('already exists')) {
      throw new Error(`Failed to create tab: ${data?.error?.message}`);
    }
  }
}

async function clearSheet(spreadsheetId, sheetName, token) {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Clear failed: HTTP ${res.status}`);
}

async function appendRows(spreadsheetId, sheetName, rows, token) {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Append failed: HTTP ${res.status}\n${text}`);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken(sa) {
  const jwt = signJwt(sa);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${data.error} — ${data.error_description}`);
  return data.access_token;
}

function signJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(sa.private_key).toString('base64url')}`;
}

main().catch(e => { console.error(e.message); process.exit(1); });
