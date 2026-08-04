/** Countries `inferCountry` can confidently guess, with a rough centroid
 *  for the globe's camera fly-to. Deliberately a small, hand-picked set —
 *  covering every code `inferCountry` can actually output, not a general
 *  geo database. */
export type Country = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

export const COUNTRIES: Record<string, Country> = {
  CN: { code: "CN", name: "China", lat: 35.86, lon: 104.2 },
  TW: { code: "TW", name: "Taiwan", lat: 23.7, lon: 121.0 },
  KR: { code: "KR", name: "South Korea", lat: 36.5, lon: 127.8 },
  JP: { code: "JP", name: "Japan", lat: 36.2, lon: 138.25 },
  TH: { code: "TH", name: "Thailand", lat: 15.87, lon: 100.99 },
  VN: { code: "VN", name: "Vietnam", lat: 14.06, lon: 108.28 },
};
