import { COUNTRIES, type Country } from "./countries";

/**
 * City-level targets for the Show page globe.
 *
 * `COUNTRIES` holds country CENTROIDS, which are fine for "point the camera
 * at China" but wrong once the camera actually zooms in: China's centroid
 * (35.86, 104.2) is rural Gansu, ~1,500km from anywhere that makes podcasts.
 * A zoom needs somewhere a show plausibly came from, so each supported
 * country maps to the city its podcast scene actually centres on — Shanghai
 * for CN (小宇宙 and Ximalaya are both there) rather than the capital by
 * reflex.
 *
 * This is explicitly a ROUGH guess, and the UI must say so. It is the
 * country guess plus a "most likely city" default — never a claim to know
 * where a given show is recorded.
 */
export type City = {
  name: string;
  /** Localised name, shown alongside the Latin one when they differ. */
  localName?: string;
  countryCode: string;
  lat: number;
  lon: number;
};

/** The city each supported country's podcast scene actually centres on. */
export const PRIMARY_CITIES: Record<string, City> = {
  CN: { name: "Shanghai", localName: "上海", countryCode: "CN", lat: 31.23, lon: 121.47 },
  TW: { name: "Taipei", localName: "台北", countryCode: "TW", lat: 25.03, lon: 121.57 },
  KR: { name: "Seoul", localName: "서울", countryCode: "KR", lat: 37.57, lon: 126.98 },
  JP: { name: "Tokyo", localName: "東京", countryCode: "JP", lat: 35.68, lon: 139.65 },
  TH: { name: "Bangkok", localName: "กรุงเทพ", countryCode: "TH", lat: 13.76, lon: 100.5 },
  VN: { name: "Ho Chi Minh City", localName: "Sài Gòn", countryCode: "VN", lat: 10.82, lon: 106.63 },
};

/**
 * Cities nameable directly in a show's own text — a real mention beats the
 * country default, since a Beijing show shouldn't be flown to Shanghai just
 * because both are in China. Aliases cover the Latin and local spellings a
 * title realistically uses. Kept small and hand-checked: a big gazetteer
 * would start matching common words (e.g. a city called "Of") and turn a
 * conservative guess into a noisy one.
 */
const NAMED_CITIES: { city: City; aliases: string[] }[] = [
  { city: { name: "Beijing", localName: "北京", countryCode: "CN", lat: 39.9, lon: 116.41 },
    aliases: ["beijing", "peking", "北京"] },
  { city: PRIMARY_CITIES.CN, aliases: ["shanghai", "上海"] },
  { city: { name: "Guangzhou", localName: "广州", countryCode: "CN", lat: 23.13, lon: 113.26 },
    aliases: ["guangzhou", "canton", "广州", "廣州"] },
  { city: { name: "Shenzhen", localName: "深圳", countryCode: "CN", lat: 22.54, lon: 114.06 },
    aliases: ["shenzhen", "深圳"] },
  { city: { name: "Chengdu", localName: "成都", countryCode: "CN", lat: 30.57, lon: 104.07 },
    aliases: ["chengdu", "成都"] },
  { city: { name: "Hong Kong", localName: "香港", countryCode: "TW", lat: 22.32, lon: 114.17 },
    aliases: ["hong kong", "hongkong", "香港"] },
  { city: PRIMARY_CITIES.TW, aliases: ["taipei", "台北", "臺北"] },
  { city: PRIMARY_CITIES.KR, aliases: ["seoul", "서울"] },
  { city: { name: "Busan", localName: "부산", countryCode: "KR", lat: 35.18, lon: 129.08 },
    aliases: ["busan", "부산"] },
  { city: PRIMARY_CITIES.JP, aliases: ["tokyo", "東京", "とうきょう"] },
  { city: { name: "Osaka", localName: "大阪", countryCode: "JP", lat: 34.69, lon: 135.5 },
    aliases: ["osaka", "大阪"] },
  { city: { name: "Kyoto", localName: "京都", countryCode: "JP", lat: 35.01, lon: 135.77 },
    aliases: ["kyoto", "京都"] },
  { city: PRIMARY_CITIES.TH, aliases: ["bangkok", "กรุงเทพ", "krung thep"] },
  { city: { name: "Chiang Mai", localName: "เชียงใหม่", countryCode: "TH", lat: 18.79, lon: 98.98 },
    aliases: ["chiang mai", "เชียงใหม่"] },
  { city: PRIMARY_CITIES.VN, aliases: ["ho chi minh", "saigon", "sài gòn", "hồ chí minh"] },
  { city: { name: "Hanoi", localName: "Hà Nội", countryCode: "VN", lat: 21.03, lon: 105.85 },
    aliases: ["hanoi", "hà nội", "ha noi"] },
];

/**
 * The city to fly to for a show, or null when the country itself is unknown.
 * A city named in the show's own text wins; otherwise the country's default.
 * Only cities inside the already-inferred country are considered — a Chinese
 * show mentioning "Tokyo" in a description is talking about Tokyo, not
 * broadcasting from it, and the country signal is the more reliable one.
 */
export function cityFor(country: Country | null, text: string): City | null {
  if (!country) return null;
  const haystack = text.toLowerCase();
  for (const { city, aliases } of NAMED_CITIES) {
    if (city.countryCode !== country.code) continue;
    if (aliases.some((a) => haystack.includes(a))) return city;
  }
  return PRIMARY_CITIES[country.code] ?? null;
}

/** The country a city belongs to (for labelling). */
export function countryOf(city: City): Country | undefined {
  return COUNTRIES[city.countryCode];
}
