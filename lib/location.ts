/**
 * formatLocation — converts stored Vercel region codes into readable place names.
 *
 * Stored format: "<region>, <country>" e.g. "CA, US" | "SP, BR" | "27, BR" | "unknown"
 * Output format: "California, United States" | "São Paulo, Brazil" | "27, Brazil"
 *
 * Pure / synchronous — no network calls.
 */

// Build Intl.DisplayNames once at module scope (not per call)
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// Expand an ISO 3166-1 alpha-2 country code → English country name.
// Returns the raw code if Intl can't resolve it (e.g. a numeric region code).
function expandCountry(code: string): string {
  try {
    const name = regionNames.of(code.trim().toUpperCase());
    // Intl returns the input unchanged for codes it doesn't recognise
    if (!name || name === code.trim().toUpperCase()) return code.trim();
    return name;
  } catch {
    return code.trim();
  }
}

// All 50 US states + DC, keyed "US-<code>" matching the stored region code.
const STATE_MAP: Record<string, string> = {
  "US-AL": "Alabama",
  "US-AK": "Alaska",
  "US-AZ": "Arizona",
  "US-AR": "Arkansas",
  "US-CA": "California",
  "US-CO": "Colorado",
  "US-CT": "Connecticut",
  "US-DE": "Delaware",
  "US-DC": "District of Columbia",
  "US-FL": "Florida",
  "US-GA": "Georgia",
  "US-HI": "Hawaii",
  "US-ID": "Idaho",
  "US-IL": "Illinois",
  "US-IN": "Indiana",
  "US-IA": "Iowa",
  "US-KS": "Kansas",
  "US-KY": "Kentucky",
  "US-LA": "Louisiana",
  "US-ME": "Maine",
  "US-MD": "Maryland",
  "US-MA": "Massachusetts",
  "US-MI": "Michigan",
  "US-MN": "Minnesota",
  "US-MS": "Mississippi",
  "US-MO": "Missouri",
  "US-MT": "Montana",
  "US-NE": "Nebraska",
  "US-NV": "Nevada",
  "US-NH": "New Hampshire",
  "US-NJ": "New Jersey",
  "US-NM": "New Mexico",
  "US-NY": "New York",
  "US-NC": "North Carolina",
  "US-ND": "North Dakota",
  "US-OH": "Ohio",
  "US-OK": "Oklahoma",
  "US-OR": "Oregon",
  "US-PA": "Pennsylvania",
  "US-RI": "Rhode Island",
  "US-SC": "South Carolina",
  "US-SD": "South Dakota",
  "US-TN": "Tennessee",
  "US-TX": "Texas",
  "US-UT": "Utah",
  "US-VT": "Vermont",
  "US-VA": "Virginia",
  "US-WA": "Washington",
  "US-WV": "West Virginia",
  "US-WI": "Wisconsin",
  "US-WY": "Wyoming",
  // Canadian provinces / territories (common Vercel regions)
  "CA-AB": "Alberta",
  "CA-BC": "British Columbia",
  "CA-MB": "Manitoba",
  "CA-NB": "New Brunswick",
  "CA-NL": "Newfoundland and Labrador",
  "CA-NS": "Nova Scotia",
  "CA-NT": "Northwest Territories",
  "CA-NU": "Nunavut",
  "CA-ON": "Ontario",
  "CA-PE": "Prince Edward Island",
  "CA-QC": "Quebec",
  "CA-SK": "Saskatchewan",
  "CA-YT": "Yukon",
  // Brazilian states (common Vercel regions)
  "BR-AC": "Acre",
  "BR-AL": "Alagoas",
  "BR-AM": "Amazonas",
  "BR-AP": "Amapá",
  "BR-BA": "Bahia",
  "BR-CE": "Ceará",
  "BR-DF": "Federal District",
  "BR-ES": "Espírito Santo",
  "BR-GO": "Goiás",
  "BR-MA": "Maranhão",
  "BR-MG": "Minas Gerais",
  "BR-MS": "Mato Grosso do Sul",
  "BR-MT": "Mato Grosso",
  "BR-PA": "Pará",
  "BR-PB": "Paraíba",
  "BR-PE": "Pernambuco",
  "BR-PI": "Piauí",
  "BR-PR": "Paraná",
  "BR-RJ": "Rio de Janeiro",
  "BR-RN": "Rio Grande do Norte",
  "BR-RO": "Rondônia",
  "BR-RR": "Roraima",
  "BR-RS": "Rio Grande do Sul",
  "BR-SC": "Santa Catarina",
  "BR-SE": "Sergipe",
  "BR-SP": "São Paulo",
  "BR-TO": "Tocantins",
  // Mexican states
  "MX-AGU": "Aguascalientes",
  "MX-BCN": "Baja California",
  "MX-BCS": "Baja California Sur",
  "MX-CAM": "Campeche",
  "MX-CHH": "Chihuahua",
  "MX-CHP": "Chiapas",
  "MX-CMX": "Mexico City",
  "MX-COA": "Coahuila",
  "MX-COL": "Colima",
  "MX-DUR": "Durango",
  "MX-GRO": "Guerrero",
  "MX-GUA": "Guanajuato",
  "MX-HID": "Hidalgo",
  "MX-JAL": "Jalisco",
  "MX-MEX": "State of Mexico",
  "MX-MIC": "Michoacán",
  "MX-MOR": "Morelos",
  "MX-NAY": "Nayarit",
  "MX-NLE": "Nuevo León",
  "MX-OAX": "Oaxaca",
  "MX-PUE": "Puebla",
  "MX-QUE": "Querétaro",
  "MX-ROO": "Quintana Roo",
  "MX-SIN": "Sinaloa",
  "MX-SLP": "San Luis Potosí",
  "MX-SON": "Sonora",
  "MX-TAB": "Tabasco",
  "MX-TAM": "Tamaulipas",
  "MX-TLA": "Tlaxcala",
  "MX-VER": "Veracruz",
  "MX-YUC": "Yucatán",
  "MX-ZAC": "Zacatecas",
};

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
function decodeHeader(v: string | null): string {
  if (!v) return "";
  try { return decodeURIComponent(v); } catch { return v; }
}
function countryName(code: string): string {
  if (!code) return "";
  try { return COUNTRY.of(code.toUpperCase()) ?? code; } catch { return code; }
}
/** "City, Region, Country" from Vercel edge headers (city-level = the
 *  project's existing privacy floor; region is the ISO-3166-2 code). */
export function formatLocationFromHeaders(get: (k: string) => string | null): string {
  const city = decodeHeader(get("x-vercel-ip-city"));
  const region = decodeHeader(get("x-vercel-ip-country-region"));
  const country = countryName(decodeHeader(get("x-vercel-ip-country")));
  return [city, region, country].filter(Boolean).join(", ") || "unknown";
}

export function formatLocation(raw: string): string {
  if (!raw || raw === "unknown") return "Unknown location";

  const parts = raw.split(", ");

  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return "Unknown location";
  }

  if (parts.length === 1) {
    // Only a single token — could be a country code or region code
    const single = parts[0].trim();
    if (!single || single === "unknown") return "Unknown location";
    // Try to expand as a country code
    const expanded = expandCountry(single);
    return expanded !== single ? expanded : single;
  }

  // Two-part: "<region>, <country>"
  const regionCode = parts[0].trim();
  const countryCode = parts[parts.length - 1].trim();

  const countryName = expandCountry(countryCode);
  const lookupKey = `${countryCode.toUpperCase()}-${regionCode.toUpperCase()}`;
  const regionName = STATE_MAP[lookupKey] ?? regionCode;

  if (!regionName || regionName === "unknown") {
    return countryName;
  }

  return `${regionName}, ${countryName}`;
}
