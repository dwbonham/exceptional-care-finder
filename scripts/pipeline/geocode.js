#!/usr/bin/env bun
// Geocoding module — resolves lat/lng for each new CCLD program.
//
// Strategy: the CCLD GIS export already includes FAC_LATITUDE/FAC_LONGITUDE
// from state spatial data. resolveCoordinates() uses those directly when they
// fall within valid California bounds, avoiding a Google Maps API call entirely.
// The API is only called for programs with missing or clearly invalid CCLD coords
// (null, zero, outside CA) — which in practice is a small fraction of records.
//
// Google Maps Geocoding API: free for 200 calls/month, ~$0.005 each after that.
// The CA component filter prevents false matches for ambiguous facility names.

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Generous California bounding box — includes border cities on all sides
const CA_LAT = { min: 32.0, max: 42.5 };
const CA_LNG = { min: -125.0, max: -113.5 };

// ─── Public error class ───────────────────────────────────────────────────────

export class GeocodingError extends Error {
  /**
   * @param {string} message
   * @param {string|number} status — Google API status string or HTTP status code
   */
  constructor(message, status) {
    super(message);
    this.name = 'GeocodingError';
    this.status = status;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve coordinates for a CCLD record.
 * Returns CCLD GIS coordinates immediately when they are valid CA coords.
 * Falls back to Google Maps Geocoding API otherwise.
 *
 * @param {import('./ingest-ccld.js').CcldRecord} ccldRecord
 * @param {string} apiKey  GOOGLE_MAPS_API_KEY (only called when CCLD coords invalid)
 * @returns {Promise<GeocodeResult>}
 */
export async function resolveCoordinates(ccldRecord, apiKey) {
  if (_isValidCaCoord(ccldRecord.lat, ccldRecord.lng)) {
    return { lat: ccldRecord.lat, lng: ccldRecord.lng, source: 'ccld' };
  }

  const result = await geocodeAddress(
    ccldRecord.address,
    ccldRecord.city,
    ccldRecord.state,
    ccldRecord.zipCode,
    apiKey
  );

  if (!result) {
    return { lat: null, lng: null, source: 'failed' };
  }

  return { source: 'geocoded', ...result };
}

/**
 * Geocode a street address via Google Maps Geocoding API.
 * Returns a GeocodeResult (without the `source` field) or null on ZERO_RESULTS.
 *
 * Throws GeocodingError for:
 *   OVER_QUERY_LIMIT / OVER_DAILY_LIMIT — quota or billing issue
 *   REQUEST_DENIED                      — invalid API key
 *   INVALID_REQUEST                     — malformed address
 *   UNKNOWN_ERROR                       — transient server error
 *   HTTP non-2xx                        — network/infra error
 *
 * @param {string} address
 * @param {string} city
 * @param {string} state
 * @param {string} zipCode
 * @param {string} apiKey
 * @returns {Promise<{lat:number, lng:number, locationType:string, formattedAddress:string}|null>}
 */
export async function geocodeAddress(address, city, state, zipCode, apiKey) {
  const query = [address, city, state, zipCode].filter(Boolean).join(', ');

  const params = new URLSearchParams({
    address: query,
    // Restrict to California to prevent false matches for common facility names
    components: 'administrative_area_level_1:CA|country:US',
    key: apiKey,
  });

  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) {
    throw new GeocodingError(`Geocoding API returned HTTP ${res.status}`, res.status);
  }

  const data = await res.json();

  switch (data.status) {
    case 'OK':
      break;

    case 'ZERO_RESULTS':
      return null;

    case 'OVER_QUERY_LIMIT':
    case 'OVER_DAILY_LIMIT':
      throw new GeocodingError(
        `Geocoding quota exceeded (${data.status}) — check billing at console.cloud.google.com`,
        data.status
      );

    case 'REQUEST_DENIED':
      throw new GeocodingError(
        `Geocoding request denied — verify API key and that the Geocoding API is enabled` +
        (data.error_message ? `: ${data.error_message}` : ''),
        data.status
      );

    case 'INVALID_REQUEST':
      throw new GeocodingError(
        `Geocoding invalid request for address "${query}": ${data.error_message ?? 'missing parameters'}`,
        data.status
      );

    default:
      throw new GeocodingError(
        `Geocoding API error: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`,
        data.status
      );
  }

  const best = data.results[0];
  const { lat, lng } = best.geometry.location;

  return {
    lat,
    lng,
    // ROOFTOP (exact) > RANGE_INTERPOLATED (block level) > GEOMETRIC_CENTER > APPROXIMATE
    // Orchestrator should flag APPROXIMATE results for manual review — map pin would
    // land at ZIP centroid rather than the actual facility address.
    locationType: best.geometry.location_type,
    formattedAddress: best.formatted_address,
  };
}

// ─── Exported helper ──────────────────────────────────────────────────────────

/**
 * Returns true if lat/lng are non-null numbers within California bounds.
 * Exported for tests and for any module that needs to pre-check CCLD coords.
 */
export function _isValidCaCoord(lat, lng) {
  if (lat == null || lng == null) return false;
  const latN = Number(lat);
  const lngN = Number(lng);
  return (
    Number.isFinite(latN) && Number.isFinite(lngN) &&
    latN >= CA_LAT.min && latN <= CA_LAT.max &&
    lngN >= CA_LNG.min && lngN <= CA_LNG.max
  );
}

// ─── Types (JSDoc only) ───────────────────────────────────────────────────────
/**
 * @typedef {object} GeocodeResult
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {'ccld'|'geocoded'|'failed'} source
 * @property {string} [locationType]     only present when source='geocoded'
 * @property {string} [formattedAddress] only present when source='geocoded'
 */
