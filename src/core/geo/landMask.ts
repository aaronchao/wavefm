/**
 * A tiny embedded land/water bitmap for the Show page's dot-matrix globe
 * (PURE — no DOM, no canvas, no network).
 *
 * `GlobeBackdrop` used to scatter dots evenly over the whole sphere, so it
 * read as a generic point-cloud ball rather than a recognisable planet — no
 * continent shapes, just uniform density. This gives every lattice dot a
 * real answer to "is this land or ocean", so the globe can shade continents
 * in and let oceans go dark, the way the reference stipple-globe look does.
 *
 * The mask is a 240×120 equirectangular bitmap (1 bit/pixel, packed MSB
 * first, base64-encoded — 3.6KB unpacked, 4.8KB as the string below),
 * generated OFFLINE from NASA's public-domain Blue Marble equirectangular
 * map (commons.wikimedia.org) by classifying each resized pixel as ocean
 * (blue-dominant) or land (everything else, including ice caps). Baked in
 * at build time — no client fetch, no runtime dependency, nothing to break.
 */

const MASK_W = 240;
const MASK_H = 120;

const MASK_B64 =
  "///7//////////////////////+AYBgEAQB////PAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/wP///QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADy8B////+AAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAADwP////8AAAHIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///+AAAAAAAAAAAAAcAAAAAAAAgAAAAAAEABAAAD///+AAAAAAAAAAAD//4AAfgAABgAAAAAOAAAAAAB///8AAAAAAAAwDA////zwHsAAAgAAAAAc8QkXoAB///4AAAAAAABgH//////w/+AABgAP4AAAH4EH/AAP//oAAAAHwAAgP//////////ABgD////+H8TDH4AP//AAAAB//AI//////////////8B//////+/nA8Af/gAAAAD//5////////////////n////5///4B5Af8AAwAAP/+P///////////////DD////////2P8AP4AH4AAfz/////////////////AD////////AAeAHwAAAAB/v////////////////+AH///////8APAADgAAAAH/P//////////////z/ggD/4D////4APwAAAAAAAH/v//////////////hwAAAHAB////8AP/AAAAAAEDfH////////////8AHAAAAEgA/////gH/gAAAAAOAuP////////////wAfAAAAAAAP////+P/wAAAAAeB4P////////////gAfAAAAAAAD/////f/8AAAAA3D//////////////6AcAAAAAAAB///////+AAAAB3n//////////////+AYAAAAAAAB///////6AAAAAH///////////////6AAAAAAAAAA//////+HAAAAAB///////////////7AAAAAAAAAAf///n/+HgAAAAH///////////////yAAAAAAAAAAP//////wAAAAAB///////////////wAAAAAAAAAAP///2//gAAAAAB/z/yf//////////CAAAAAAAAAAP///3/wAAAAAA/+Z/gHz////////+HAAAAAAAAAAP/////gAAAAAA/wMfnHx////////wAAAAAAAAAAAP////+AAAAAAA/Bid//5////////gEAAAAAAAAAAP////8AAAAAAA/AAM//4///////7gMAAAAAAAAAAH////8AAAAAAAeAEI//9///////5wYAAAAAAAAAAD////8AAAAAAAI/gAA/////////xy4AAAAAAAAAAB////4AAAAAAAf/gAA/////////4HgAAAAAAAAAAA////gAAAAAAA//4IB/////////4MAAAAAAAAAAAAX///AAAAAAAA//+fP/////////8AAAAAAAAAAAAAD//jAAAAAAAB//////3///////4AAAAAAAAAAAAAL/wBgAAAAAAD////9/z///////4AAAAAAAAAAAAAF/wBgAAAAAAH////8/4P//////wAAAAAAAAAAAAAC/gAAAAAAAAP////+f8gP/////gAAAAAAAAAAAAAAfgAAAAAAAAf/////P/4H/////YAAAAAAAAAAAAAAPgD4AAAAAAf/////P/8D////4AAAAAAAAAAAAAAAPwwMAAAAAAf/////v/4B/8f+wAAAAAAAAAAAAAAAH5wAwAAAAAf/////n/wA/wP8gAAAAAAAAAAAAAAAB/wAAAAAAAf/////z/gA/gP+AIAAAAAAAAAAAAAAAf0AAAAAAAf/////z+AAfAP/AYAAAAAAAAAAAAAAAB+AAAAAAAf/////7wAAeAB/AIAAAAAAAAAAAAAAAAOAAAAAAAf//////AAAOAB/gAAAAAAAAAAAAAAAAAGB4AAAAAf/////+EAAOABPAGAAAAAAAAAAAAAAAAGD/wAAAAP//////8AAOABGAEAAAAAAAAAAAAAAAAB//4AAAAH//////4AABABAAHAAAAAAAAAAAAAAAAAP/8AAAAD//////4AABAAgADAAAAAAAAAAAAAAAAAH//gAAAA/H////wAAAAEwDgAAAAAAAAAAAAAAAAAH//4AAAAAA////gAAAADYHAAAAAAAAAAAAAAAAAAP//8AAAAAA////AAAAAB4fAAAAAAAgAAAAAAAAAAf//8AAAAAA///+AAAAAA4/AAAAAABgAAAAAAAAAA////AAAAAA//78AAAAAA4/AGAAAABAAAAAAAAAAA////gAAAAA///4AAAAAAceYG4AAAAAAAAAAAAAAA////+AAAAAf//wAAAAAAMGYD/AAAAAAAAAAAAAAA/////AAAAAP//wAAAAAAEAAAfmAAAAAAAAAAAAAAf////gAAAAP//wAAAAAAD4AAfwAAAAAAAAAAAAAAP////gAAAAH//wAAAAAAAcBAfQAAAAAAAAAAAAAAP////AAAAAH//4AAAAAAAACAAIAAAAAAAAAAAAAAH///+AAAAAH//4AAAAAAAAAEAAAAAAAAAAAAAAAAH///+AAAAAH//4IAAAAAAAAPiAAAAgAAAAAAAAAAD///8AAAAAP//4YAAAAAAAB/DAAAAAAAAAAAAAAAB///8AAAAAP//44AAAAAAAD/jAAABAAAAAAAAAAAAf//8AAAAAP//h4AAAAAAAH//gAAAgAAAAAAAAAAAf//8AAAAAP//B4AAAAAAAP//gAAAAAAAAAAAAAAAP//4AAAAAH/+BwAAAAAAA///4AAAAAAAAAAAAAAAP//4AAAAAH//BwAAAAAAD///4AAAAAAAAAAAAAAAf//AAAAAAD//BwAAAAAAH///8AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAH///+AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAH////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAAf/4AAAAAAB/4AAAAAAAAD////AAAAAAAAAAAAAAAf/wAAAAAAA/wAAAAAAAAD///+AAAAAAAAAAAAAAAf/gAAAAAAA/gAAAAAAAAB+B/+AAAAAAAAAAAAAAA//gAAAAAAA4AAAAAAAAADgAf8AAAAAAAAAAAAAAA/+AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH4AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAwAAgAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAQABgAAAAAAAAAAAB8AAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAACIAAAgAAAAAAAAAAAAAAAADwAAAAAAAAAAAH4AAf/////+oAAAAAAAAAAAAAAAHwAAAAAAAAAAD//+D////////gAAAAAAAAAAAAAB/wAAAAABg/w///////////////wAAAAAAAAAAAAA/wAAAAH////+//////////////+AAAAAAAgAD/4+/gAAAB////////////////////wAgAAA/////////gAAAf////////////////////AAAAAf/////////+AAA/////////////////////gAgAH///////////+Af//////////////////////5////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////";

let cache: Uint8Array | null = null;

function bits(): Uint8Array {
  if (cache) return cache;
  const bin = atob(MASK_B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  cache = arr;
  return arr;
}

/**
 * Is this lat/lon over land (or ice)? False for open ocean, and for
 * anything out of range. Row 0 of the bitmap is the north pole, so `lat`
 * inverts against row index.
 */
export function isLand(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
  const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
  const i = y * MASK_W + x;
  const byte = bits()[i >> 3];
  return ((byte >> (7 - (i % 8))) & 1) === 1;
}
