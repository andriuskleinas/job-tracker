/**
 * Job type + location model shared by the application forms and the board.
 *
 * A role is worked one of three ways, and each carries a different rule about
 * where it's based:
 *   remote  — location optional (the whole point is it's anywhere)
 *   hybrid  — a base office exists, so city + country are required
 *   onsite  — same, city + country required
 *
 * The city picker is the primary control: pick a city and its country fills in
 * automatically. Country stays independently selectable for remote roles where
 * only a country is known. See {@link CITIES} for the reference data.
 */

export const JOB_TYPES = ["remote", "hybrid", "onsite"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_TYPE_META: Record<
  JobType,
  { label: string; short: string; hint: string; locationRequired: boolean }
> = {
  remote: {
    label: "Fully remote",
    short: "Remote",
    hint: "Worked from anywhere — location is optional.",
    locationRequired: false,
  },
  hybrid: {
    label: "Hybrid",
    short: "Hybrid",
    hint: "Split between home and an office — city and country are required.",
    locationRequired: true,
  },
  onsite: {
    label: "On-site",
    short: "On-site",
    hint: "Based at an office — city and country are required.",
    locationRequired: true,
  },
};

export function jobTypeMeta(value: string | null | undefined) {
  return value && value in JOB_TYPE_META ? JOB_TYPE_META[value as JobType] : null;
}

/** ISO 3166-1 alpha-2 → English name. Broad enough to cover most job markets. */
const COUNTRY_ENTRIES: [code: string, name: string][] = [
  ["AE", "United Arab Emirates"],
  ["AF", "Afghanistan"],
  ["AL", "Albania"],
  ["AM", "Armenia"],
  ["AO", "Angola"],
  ["AR", "Argentina"],
  ["AT", "Austria"],
  ["AU", "Australia"],
  ["AZ", "Azerbaijan"],
  ["BA", "Bosnia and Herzegovina"],
  ["BD", "Bangladesh"],
  ["BE", "Belgium"],
  ["BG", "Bulgaria"],
  ["BH", "Bahrain"],
  ["BO", "Bolivia"],
  ["BR", "Brazil"],
  ["BY", "Belarus"],
  ["CA", "Canada"],
  ["CH", "Switzerland"],
  ["CL", "Chile"],
  ["CM", "Cameroon"],
  ["CN", "China"],
  ["CO", "Colombia"],
  ["CR", "Costa Rica"],
  ["CY", "Cyprus"],
  ["CZ", "Czechia"],
  ["DE", "Germany"],
  ["DK", "Denmark"],
  ["DO", "Dominican Republic"],
  ["DZ", "Algeria"],
  ["EC", "Ecuador"],
  ["EE", "Estonia"],
  ["EG", "Egypt"],
  ["ES", "Spain"],
  ["ET", "Ethiopia"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["GE", "Georgia"],
  ["GH", "Ghana"],
  ["GR", "Greece"],
  ["GT", "Guatemala"],
  ["HK", "Hong Kong"],
  ["HN", "Honduras"],
  ["HR", "Croatia"],
  ["HU", "Hungary"],
  ["ID", "Indonesia"],
  ["IE", "Ireland"],
  ["IL", "Israel"],
  ["IN", "India"],
  ["IQ", "Iraq"],
  ["IR", "Iran"],
  ["IS", "Iceland"],
  ["IT", "Italy"],
  ["JM", "Jamaica"],
  ["JO", "Jordan"],
  ["JP", "Japan"],
  ["KE", "Kenya"],
  ["KH", "Cambodia"],
  ["KR", "South Korea"],
  ["KW", "Kuwait"],
  ["KZ", "Kazakhstan"],
  ["LB", "Lebanon"],
  ["LK", "Sri Lanka"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["LV", "Latvia"],
  ["MA", "Morocco"],
  ["MD", "Moldova"],
  ["ME", "Montenegro"],
  ["MK", "North Macedonia"],
  ["MT", "Malta"],
  ["MX", "Mexico"],
  ["MY", "Malaysia"],
  ["NG", "Nigeria"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["NP", "Nepal"],
  ["NZ", "New Zealand"],
  ["OM", "Oman"],
  ["PA", "Panama"],
  ["PE", "Peru"],
  ["PH", "Philippines"],
  ["PK", "Pakistan"],
  ["PL", "Poland"],
  ["PR", "Puerto Rico"],
  ["PT", "Portugal"],
  ["PY", "Paraguay"],
  ["QA", "Qatar"],
  ["RO", "Romania"],
  ["RS", "Serbia"],
  ["RU", "Russia"],
  ["SA", "Saudi Arabia"],
  ["SE", "Sweden"],
  ["SG", "Singapore"],
  ["SI", "Slovenia"],
  ["SK", "Slovakia"],
  ["TH", "Thailand"],
  ["TN", "Tunisia"],
  ["TR", "Türkiye"],
  ["TW", "Taiwan"],
  ["TZ", "Tanzania"],
  ["UA", "Ukraine"],
  ["UG", "Uganda"],
  ["US", "United States"],
  ["UY", "Uruguay"],
  ["UZ", "Uzbekistan"],
  ["VE", "Venezuela"],
  ["VN", "Vietnam"],
  ["ZA", "South Africa"],
  ["ZW", "Zimbabwe"],
];

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = COUNTRY_ENTRIES.map(([code, name]) => ({ code, name })).sort(
  (a, b) => a.name.localeCompare(b.name),
);

const NAME_BY_CODE = new Map(COUNTRY_ENTRIES.map(([code, name]) => [code, name]));
const CODE_BY_NAME = new Map(COUNTRY_ENTRIES.map(([code, name]) => [name.toLowerCase(), code]));

/** Turn a two-letter country code into its flag emoji (regional indicators). */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryCode(name: string | null | undefined): string | null {
  return name ? (CODE_BY_NAME.get(name.trim().toLowerCase()) ?? null) : null;
}

/** Flag emoji for a stored country name, empty string when we can't map it. */
export function flagForCountry(name: string | null | undefined): string {
  return flagEmoji(countryCode(name));
}

/**
 * Curated cities keyed to a country code — capitals plus the metros people
 * actually apply into, weighted toward Europe and the Baltics. Picking one of
 * these fills the country in automatically. Not exhaustive: the country field
 * stays free-standing so a role in an unlisted city can still record a country.
 */
const CITY_ENTRIES: [city: string, code: string][] = [
  // Baltics & Nordics
  ["Vilnius", "LT"],
  ["Kaunas", "LT"],
  ["Klaipėda", "LT"],
  ["Riga", "LV"],
  ["Tallinn", "EE"],
  ["Tartu", "EE"],
  ["Helsinki", "FI"],
  ["Espoo", "FI"],
  ["Tampere", "FI"],
  ["Stockholm", "SE"],
  ["Gothenburg", "SE"],
  ["Malmö", "SE"],
  ["Oslo", "NO"],
  ["Bergen", "NO"],
  ["Copenhagen", "DK"],
  ["Aarhus", "DK"],
  ["Reykjavík", "IS"],
  // Western Europe
  ["London", "GB"],
  ["Manchester", "GB"],
  ["Edinburgh", "GB"],
  ["Bristol", "GB"],
  ["Dublin", "IE"],
  ["Cork", "IE"],
  ["Amsterdam", "NL"],
  ["Rotterdam", "NL"],
  ["Eindhoven", "NL"],
  ["Brussels", "BE"],
  ["Antwerp", "BE"],
  ["Luxembourg", "LU"],
  ["Paris", "FR"],
  ["Lyon", "FR"],
  ["Marseille", "FR"],
  ["Toulouse", "FR"],
  ["Berlin", "DE"],
  ["Munich", "DE"],
  ["Frankfurt", "DE"],
  ["Hamburg", "DE"],
  ["Cologne", "DE"],
  ["Stuttgart", "DE"],
  ["Zürich", "CH"],
  ["Geneva", "CH"],
  ["Basel", "CH"],
  ["Vienna", "AT"],
  ["Graz", "AT"],
  // Southern Europe
  ["Madrid", "ES"],
  ["Barcelona", "ES"],
  ["Valencia", "ES"],
  ["Málaga", "ES"],
  ["Lisbon", "PT"],
  ["Porto", "PT"],
  ["Rome", "IT"],
  ["Milan", "IT"],
  ["Turin", "IT"],
  ["Naples", "IT"],
  ["Athens", "GR"],
  ["Thessaloniki", "GR"],
  ["Valletta", "MT"],
  ["Nicosia", "CY"],
  // Central & Eastern Europe
  ["Warsaw", "PL"],
  ["Kraków", "PL"],
  ["Wrocław", "PL"],
  ["Gdańsk", "PL"],
  ["Poznań", "PL"],
  ["Prague", "CZ"],
  ["Brno", "CZ"],
  ["Bratislava", "SK"],
  ["Budapest", "HU"],
  ["Bucharest", "RO"],
  ["Cluj-Napoca", "RO"],
  ["Sofia", "BG"],
  ["Zagreb", "HR"],
  ["Ljubljana", "SI"],
  ["Belgrade", "RS"],
  ["Sarajevo", "BA"],
  ["Skopje", "MK"],
  ["Tirana", "AL"],
  ["Kyiv", "UA"],
  ["Lviv", "UA"],
  ["Chișinău", "MD"],
  ["Minsk", "BY"],
  ["Tbilisi", "GE"],
  ["Yerevan", "AM"],
  // North America
  ["New York", "US"],
  ["San Francisco", "US"],
  ["Los Angeles", "US"],
  ["Seattle", "US"],
  ["Austin", "US"],
  ["Boston", "US"],
  ["Chicago", "US"],
  ["Denver", "US"],
  ["Atlanta", "US"],
  ["Miami", "US"],
  ["Washington", "US"],
  ["Toronto", "CA"],
  ["Vancouver", "CA"],
  ["Montreal", "CA"],
  ["Mexico City", "MX"],
  ["Guadalajara", "MX"],
  // Middle East & Africa
  ["Dubai", "AE"],
  ["Abu Dhabi", "AE"],
  ["Tel Aviv", "IL"],
  ["Doha", "QA"],
  ["Riyadh", "SA"],
  ["Istanbul", "TR"],
  ["Ankara", "TR"],
  ["Cairo", "EG"],
  ["Cape Town", "ZA"],
  ["Johannesburg", "ZA"],
  ["Nairobi", "KE"],
  ["Lagos", "NG"],
  ["Casablanca", "MA"],
  // Asia-Pacific
  ["Singapore", "SG"],
  ["Tokyo", "JP"],
  ["Osaka", "JP"],
  ["Seoul", "KR"],
  ["Hong Kong", "HK"],
  ["Shanghai", "CN"],
  ["Beijing", "CN"],
  ["Shenzhen", "CN"],
  ["Bengaluru", "IN"],
  ["Mumbai", "IN"],
  ["Hyderabad", "IN"],
  ["Delhi", "IN"],
  ["Pune", "IN"],
  ["Jakarta", "ID"],
  ["Bangkok", "TH"],
  ["Kuala Lumpur", "MY"],
  ["Manila", "PH"],
  ["Ho Chi Minh City", "VN"],
  ["Hanoi", "VN"],
  ["Sydney", "AU"],
  ["Melbourne", "AU"],
  ["Brisbane", "AU"],
  ["Auckland", "NZ"],
  // Latin America
  ["São Paulo", "BR"],
  ["Rio de Janeiro", "BR"],
  ["Buenos Aires", "AR"],
  ["Santiago", "CL"],
  ["Bogotá", "CO"],
  ["Lima", "PE"],
  ["Montevideo", "UY"],
];

export type City = { city: string; country: string; code: string };

export const CITIES: City[] = CITY_ENTRIES.map(([city, code]) => ({
  city,
  code,
  country: NAME_BY_CODE.get(code) ?? code,
})).sort((a, b) => a.city.localeCompare(b.city));
