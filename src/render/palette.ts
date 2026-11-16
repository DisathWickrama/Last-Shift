// The colour palette, in one place.
//
// DESIGN.md: fluoro green-white inside, sodium orange from the pumps, fog grey
// outside, and deep red reserved ONLY for gore. Keeping every colour here makes
// that rule easy to check: if a file wants red, it has to ask for PAL.gore.

export const PAL = {
  // inside, under the fluoro tubes
  fluoro: '#e4f5dc',
  fluoroDim: '#9fb89a',
  wall: '#33423a',
  wallDark: '#232e29',
  ceiling: '#1a211e',
  floorA: '#55665a',
  floorB: '#465449',
  counter: '#2a2f2b',
  counterTop: '#58635a',
  counterEdge: '#7b8a7c',
  metal: '#76857c',
  fridge: '#c8ecd8',
  // outside
  fog: '#59615f',
  fogLight: '#7a8482',
  fogDark: '#2c3231',
  night: '#0d1110',
  sodium: '#f29a2e',
  sodiumDim: '#8a5a22',
  // interface
  ink: '#d9e6d4',
  inkDim: '#7f9082',
  panel: '#0b100e',
  panelEdge: '#3d4d43',
  you: '#9aa79c',
  wren: '#f2b872',
  radio: '#a8e6a1',
  // gore only
  gore: '#7a0c12',
  goreDark: '#3d0508',
  black: '#050706',
} as const;

// The helpers below accept '#rrggbb' or 'rgb(r,g,b)' and always return '#rrggbb',
// so their results can be fed straight back into each other: shade(mix(a, b, 0.5), 0.8).

function parse(color: string): [number, number, number] {
  if (color[0] === '#') {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = color.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Multiply a colour's brightness. factor 1 = unchanged, 0.5 = half as bright. */
export function shade(color: string, factor: number): string {
  const [r, g, b] = parse(color);
  return hex(r * factor, g * factor, b * factor);
}

/** Blend two colours. t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** The same colour with transparency. */
export function alpha(color: string, a: number): string {
  const [r, g, b] = parse(color);
  return `rgba(${r},${g},${b},${a})`;
}
