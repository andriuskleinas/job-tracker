/**
 * Flag-coloured variants of the Job Tracker logo tile. A user picks one on the
 * account page; it's stored as `profiles.logo_theme` (null = the standard
 * black tile). Each flag is a few shapes in a unit square — enough to read as
 * the flag at 32px, not a vexillologist's drawing. The centre is covered by
 * the briefcase, so central emblems are left out or kept to a simple mark.
 */

/** Coordinates are fractions of the tile (0–1). Shapes paint in order. */
export type FlagShape =
  | { kind: "rect"; color: string; x: number; y: number; w: number; h: number }
  | { kind: "poly"; color: string; points: [number, number][] }
  | { kind: "disc"; color: string; x: number; y: number; r: number }
  | { kind: "star"; color: string; x: number; y: number; r: number }
  | { kind: "line"; color: string; x1: number; y1: number; x2: number; y2: number; w: number };

export type LogoTheme = {
  id: string;
  name: string;
  group: "pride" | "cause" | "country";
  shapes: FlagShape[];
};

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */
/* ------------------------------------------------------------------ */

type Band = string | [color: string, weight: number];

function bands(list: Band[], vertical = false): FlagShape[] {
  const items = list.map((b) =>
    typeof b === "string" ? { color: b, weight: 1 } : { color: b[0], weight: b[1] },
  );
  const total = items.reduce((s, b) => s + b.weight, 0);
  let at = 0;
  return items.map(({ color, weight }) => {
    const start = at / total;
    at += weight;
    const size = weight / total;
    return vertical
      ? { kind: "rect", color, x: start, y: 0, w: size, h: 1 }
      : { kind: "rect", color, x: 0, y: start, w: 1, h: size };
  });
}

/** Horizontal stripes, top to bottom. */
const h = (...list: Band[]) => bands(list);
/** Vertical stripes, hoist to fly. */
const v = (...list: Band[]) => bands(list, true);
/** `n` alternating horizontal stripes starting with `a`. */
const stripes = (n: number, a: string, b: string) =>
  h(...Array.from({ length: n }, (_, i) => (i % 2 ? b : a)));

const fill = (color: string): FlagShape => ({ kind: "rect", color, x: 0, y: 0, w: 1, h: 1 });
const rect = (color: string, x: number, y: number, w: number, hh: number): FlagShape => ({
  kind: "rect",
  color,
  x,
  y,
  w,
  h: hh,
});
const poly = (color: string, ...points: [number, number][]): FlagShape => ({
  kind: "poly",
  color,
  points,
});
const disc = (color: string, x = 0.5, y = 0.5, r = 0.3): FlagShape => ({
  kind: "disc",
  color,
  x,
  y,
  r,
});
const star = (color: string, x = 0.5, y = 0.5, r = 0.3): FlagShape => ({
  kind: "star",
  color,
  x,
  y,
  r,
});
const line = (
  color: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
): FlagShape => ({
  kind: "line",
  color,
  x1,
  y1,
  x2,
  y2,
  w,
});

/** Triangle from the hoist edge reaching `depth` across. */
const hoist = (color: string, depth = 0.5) => poly(color, [0, 0], [depth, 0.5], [0, 1]);

/** Off-centre Scandinavian cross. */
const nordic = (color: string, w = 0.2): FlagShape[] => [
  rect(color, 0.36 - w / 2, 0, w, 1),
  rect(color, 0, 0.5 - w / 2, 1, w),
];

/** Centred cross; `l` is arm-to-arm length (1 = edge to edge). */
const plus = (color: string, w = 0.2, l = 1, x = 0.5, y = 0.5): FlagShape[] => [
  rect(color, x - w / 2, y - l / 2, w, l),
  rect(color, x - l / 2, y - w / 2, l, w),
];

const saltire = (color: string, w: number): FlagShape[] => [
  line(color, 0, 0, 1, 1, w),
  line(color, 1, 0, 0, 1, w),
];

/** Saw-tooth hoist band (Bahrain, Qatar). */
function serrated(color: string, teeth: number, base = 0.25, tip = 0.4): FlagShape {
  const points: [number, number][] = [
    [0, 0],
    [base, 0],
  ];
  for (let i = 0; i < teeth; i++) {
    points.push([tip, (i + 0.5) / teeth], [base, (i + 1) / teeth]);
  }
  points.push([0, 1]);
  return poly(color, ...points);
}

/** Crescent: a disc with a background-coloured disc bitten out of it. */
const crescent = (
  color: string,
  bg: string,
  x: number,
  y: number,
  r: number,
  shift = 0.25,
): FlagShape[] => [disc(color, x, y, r), disc(bg, x + r * shift, y, r * 0.82)];

/** Union Jack scaled into a box (whole tile, or a canton). */
function unionJack(x = 0, y = 0, w = 1, hh = 1): FlagShape[] {
  const at = (px: number, py: number): [number, number] => [x + px * w, y + py * hh];
  const diag = (color: string, width: number): FlagShape[] => {
    const [ax, ay] = at(0, 0);
    const [bx, by] = at(1, 1);
    const [cx, cy] = at(1, 0);
    const [dx, dy] = at(0, 1);
    return [line(color, ax, ay, bx, by, width * w), line(color, cx, cy, dx, dy, width * w)];
  };
  return [
    rect("#012169", x, y, w, hh),
    ...diag("#FFFFFF", 0.2),
    ...diag("#C8102E", 0.07),
    rect("#FFFFFF", x + 0.4 * w, y, 0.2 * w, hh),
    rect("#FFFFFF", x, y + 0.4 * hh, w, 0.2 * hh),
    rect("#C8102E", x + 0.45 * w, y, 0.1 * w, hh),
    rect("#C8102E", x, y + 0.45 * hh, w, 0.1 * hh),
  ];
}

/* ------------------------------------------------------------------ */
/* Pride & identity                                                    */
/* ------------------------------------------------------------------ */

const RAINBOW = ["#E40303", "#FF8C00", "#FFED00", "#008026", "#24408E", "#732982"];

const PRIDE: [id: string, name: string, shapes: FlagShape[]][] = [
  ["rainbow", "Rainbow pride", h(...RAINBOW)],
  [
    "progress",
    "Progress pride",
    [
      ...h(...RAINBOW),
      hoist("#000000", 0.62),
      hoist("#784F17", 0.52),
      hoist("#5BCEFA", 0.42),
      hoist("#F5A9B8", 0.32),
      hoist("#FFFFFF", 0.22),
    ],
  ],
  ["trans", "Transgender", h("#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA")],
  ["bisexual", "Bisexual", h(["#D60270", 2], "#9B4F96", ["#0038A8", 2])],
  ["lesbian", "Lesbian", h("#D52D00", "#FF9A56", "#FFFFFF", "#D362A4", "#A30262")],
  ["pansexual", "Pansexual", h("#FF218C", "#FFD800", "#21B1FF")],
  ["nonbinary", "Non-binary", h("#FCF434", "#FFFFFF", "#9C59D1", "#2C2C2C")],
  ["asexual", "Asexual", h("#000000", "#A3A3A3", "#FFFFFF", "#800080")],
];

/* ------------------------------------------------------------------ */
/* Movements & causes                                                  */
/* ------------------------------------------------------------------ */

/** Parallel stripes along the top-left → bottom-right diagonal, centred on it. */
function diagonalBand(colors: string[], w: number): FlagShape[] {
  const k = Math.SQRT1_2;
  return colors.map((color, i) => {
    const o = (i - (colors.length - 1) / 2) * w;
    return line(color, -0.2 + o * k, -0.2 - o * k, 1.2 + o * k, 1.2 - o * k, w + 0.01);
  });
}

const CAUSES: [id: string, name: string, shapes: FlagShape[]][] = [
  ["blm", "Black Lives Matter", h("#FCE300", ["#000000", 4], "#FCE300")],
  ["pan-african", "Pan-African", h("#E31B23", "#000000", "#00853F")],
  [
    "peace",
    "Peace",
    h("#6B2C91", "#2E3192", "#00AEEF", "#00A651", "#FFF200", "#F7941D", "#ED1C24"),
  ],
  [
    "climate",
    "Climate stripes",
    v(
      "#08306B",
      "#2171B5",
      "#6BAED6",
      "#C6DBEF",
      "#FEE0D2",
      "#FC9272",
      "#EF3B2C",
      "#CB181D",
      "#A50F15",
      "#67000D",
    ),
  ],
  ["womens-rights", "Women's rights", h("#6A1B9A", "#FFFFFF", "#2E7D32")],
  [
    "disability",
    "Disability pride",
    [
      fill("#595959"),
      ...diagonalBand(["#CF7280", "#EEDE77", "#E8E8E8", "#7BC2E0", "#3BB07D"], 0.07),
    ],
  ],
  ["refugees", "Refugees", h(["#F7921E", 2], "#000000", ["#F7921E", 2])],
];

/* ------------------------------------------------------------------ */
/* Countries & regions                                                 */
/* ------------------------------------------------------------------ */

const COUNTRY_FLAGS: [code: string, name: string, shapes: FlagShape[]][] = [
  ["AF", "Afghanistan", v("#000000", "#D32011", "#007A36")],
  ["AL", "Albania", [fill("#E41E20"), disc("#000000", 0.5, 0.5, 0.28)]],
  [
    "DZ",
    "Algeria",
    [...v("#006233", "#FFFFFF"), ...crescent("#D21034", "#FFFFFF", 0.5, 0.5, 0.22)],
  ],
  ["AO", "Angola", [...h("#CC092F", "#000000"), star("#FFCB00", 0.5, 0.5, 0.18)]],
  ["AR", "Argentina", [...h("#74ACDF", "#FFFFFF", "#74ACDF"), disc("#F6B40E", 0.5, 0.5, 0.12)]],
  ["AM", "Armenia", h("#D90012", "#0033A0", "#F2A800")],
  [
    "AU",
    "Australia",
    [
      fill("#012169"),
      ...unionJack(0, 0, 0.5, 0.5),
      star("#FFFFFF", 0.25, 0.76, 0.13),
      star("#FFFFFF", 0.76, 0.22, 0.07),
      star("#FFFFFF", 0.62, 0.5, 0.07),
      star("#FFFFFF", 0.88, 0.44, 0.07),
      star("#FFFFFF", 0.76, 0.84, 0.07),
    ],
  ],
  ["AT", "Austria", h("#ED2939", "#FFFFFF", "#ED2939")],
  ["AZ", "Azerbaijan", h("#00B5E2", "#EF3340", "#509E2F")],
  ["BH", "Bahrain", [fill("#CE1126"), serrated("#FFFFFF", 5)]],
  ["BD", "Bangladesh", [fill("#006A4E"), disc("#F42A41", 0.45, 0.5, 0.3)]],
  ["BY", "Belarus", [...h(["#C8313E", 2], "#4AA657"), rect("#FFFFFF", 0, 0, 0.16, 1)]],
  ["BE", "Belgium", v("#000000", "#FDDA24", "#EF3340")],
  ["BO", "Bolivia", h("#D52B1E", "#F9E300", "#007934")],
  [
    "BA",
    "Bosnia and Herzegovina",
    [fill("#002395"), poly("#FECB00", [0.28, 0], [0.82, 0], [0.82, 1])],
  ],
  [
    "BR",
    "Brazil",
    [
      fill("#009C3B"),
      poly("#FFDF00", [0.5, 0.1], [0.92, 0.5], [0.5, 0.9], [0.08, 0.5]),
      disc("#002776", 0.5, 0.5, 0.22),
    ],
  ],
  ["BG", "Bulgaria", h("#FFFFFF", "#00966E", "#D62612")],
  ["KH", "Cambodia", h("#032EA1", ["#E00025", 2], "#032EA1")],
  ["CM", "Cameroon", [...v("#007A5E", "#CE1126", "#FCD116"), star("#FCD116", 0.5, 0.5, 0.14)]],
  ["CA", "Canada", v("#D80621", ["#FFFFFF", 2], "#D80621")],
  [
    "CL",
    "Chile",
    [
      ...h("#FFFFFF", "#D52B1E"),
      rect("#0039A6", 0, 0, 0.36, 0.5),
      star("#FFFFFF", 0.18, 0.25, 0.1),
    ],
  ],
  [
    "CN",
    "China",
    [
      fill("#EE1C25"),
      star("#FFDE00", 0.2, 0.25, 0.14),
      star("#FFDE00", 0.4, 0.1, 0.045),
      star("#FFDE00", 0.47, 0.2, 0.045),
      star("#FFDE00", 0.47, 0.33, 0.045),
      star("#FFDE00", 0.4, 0.43, 0.045),
    ],
  ],
  ["CO", "Colombia", h(["#FCD116", 2], "#003893", "#CE1126")],
  ["CR", "Costa Rica", h("#002B7F", "#FFFFFF", ["#CE1126", 2], "#FFFFFF", "#002B7F")],
  ["CI", "Côte d'Ivoire", v("#F77F00", "#FFFFFF", "#009E60")],
  ["HR", "Croatia", h("#FF0000", "#FFFFFF", "#171796")],
  [
    "CU",
    "Cuba",
    [...stripes(5, "#002A8F", "#FFFFFF"), hoist("#CF142B", 0.5), star("#FFFFFF", 0.17, 0.5, 0.1)],
  ],
  [
    "CY",
    "Cyprus",
    [fill("#FFFFFF"), disc("#D57800", 0.5, 0.42, 0.2), rect("#4E5B31", 0.32, 0.72, 0.36, 0.06)],
  ],
  ["CZ", "Czechia", [...h("#FFFFFF", "#D7141A"), hoist("#11457E", 0.5)]],
  ["DK", "Denmark", [fill("#C8102E"), ...nordic("#FFFFFF")]],
  [
    "DO",
    "Dominican Republic",
    [
      rect("#002D62", 0, 0, 0.5, 0.5),
      rect("#CE1126", 0.5, 0, 0.5, 0.5),
      rect("#CE1126", 0, 0.5, 0.5, 0.5),
      rect("#002D62", 0.5, 0.5, 0.5, 0.5),
      ...plus("#FFFFFF", 0.14),
    ],
  ],
  ["EC", "Ecuador", h(["#FFDD00", 2], "#034EA2", "#ED1C24")],
  ["EG", "Egypt", h("#CE1126", "#FFFFFF", "#000000")],
  ["SV", "El Salvador", h("#0F47AF", "#FFFFFF", "#0F47AF")],
  ["GB-ENG", "England", [fill("#FFFFFF"), ...plus("#CE1124", 0.2)]],
  ["EE", "Estonia", h("#0072CE", "#000000", "#FFFFFF")],
  [
    "ET",
    "Ethiopia",
    [
      ...h("#078930", "#FCDD09", "#DA121A"),
      disc("#0F47AF", 0.5, 0.5, 0.22),
      star("#FCDD09", 0.5, 0.5, 0.15),
    ],
  ],
  [
    "EU",
    "European Union",
    [
      fill("#003399"),
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return star("#FFCC00", 0.5 + Math.sin(a) * 0.32, 0.5 - Math.cos(a) * 0.32, 0.055);
      }),
    ],
  ],
  ["FI", "Finland", [fill("#FFFFFF"), ...nordic("#002F6C")]],
  ["FR", "France", v("#002395", "#FFFFFF", "#ED2939")],
  [
    "GE",
    "Georgia",
    [
      fill("#FFFFFF"),
      ...plus("#FF0000", 0.16),
      ...plus("#FF0000", 0.05, 0.18, 0.22, 0.22),
      ...plus("#FF0000", 0.05, 0.18, 0.78, 0.22),
      ...plus("#FF0000", 0.05, 0.18, 0.22, 0.78),
      ...plus("#FF0000", 0.05, 0.18, 0.78, 0.78),
    ],
  ],
  ["DE", "Germany", h("#000000", "#DD0000", "#FFCE00")],
  ["GH", "Ghana", [...h("#CE1126", "#FCD116", "#006B3F"), star("#000000", 0.5, 0.5, 0.16)]],
  [
    "GR",
    "Greece",
    [
      ...stripes(9, "#0D5EAF", "#FFFFFF"),
      rect("#0D5EAF", 0, 0, 0.5, 5 / 9),
      ...plus("#FFFFFF", 1 / 9, 0.5, 0.25, 5 / 18),
    ],
  ],
  ["GT", "Guatemala", v("#4997D0", "#FFFFFF", "#4997D0")],
  ["HN", "Honduras", h("#0073CF", "#FFFFFF", "#0073CF")],
  ["HK", "Hong Kong", [fill("#DE2910"), star("#FFFFFF", 0.5, 0.5, 0.3)]],
  ["HU", "Hungary", h("#CE2939", "#FFFFFF", "#477050")],
  ["IS", "Iceland", [fill("#02529C"), ...nordic("#FFFFFF", 0.22), ...nordic("#DC1E35", 0.11)]],
  ["IN", "India", [...h("#FF9933", "#FFFFFF", "#138808"), disc("#000080", 0.5, 0.5, 0.12)]],
  ["ID", "Indonesia", h("#FF0000", "#FFFFFF")],
  ["IR", "Iran", h("#239F40", "#FFFFFF", "#DA0000")],
  ["IQ", "Iraq", h("#CE1126", "#FFFFFF", "#000000")],
  ["IE", "Ireland", v("#169B62", "#FFFFFF", "#FF883E")],
  [
    "IL",
    "Israel",
    h(["#FFFFFF", 15], ["#0038B8", 25], ["#FFFFFF", 80], ["#0038B8", 25], ["#FFFFFF", 15]),
  ],
  ["IT", "Italy", v("#009246", "#FFFFFF", "#CE2B37")],
  [
    "JM",
    "Jamaica",
    [
      fill("#009B3A"),
      poly("#000000", [0, 0], [0.5, 0.5], [0, 1]),
      poly("#000000", [1, 0], [0.5, 0.5], [1, 1]),
      ...saltire("#FED100", 0.14),
    ],
  ],
  ["JP", "Japan", [fill("#FFFFFF"), disc("#BC002D", 0.5, 0.5, 0.3)]],
  [
    "JO",
    "Jordan",
    [
      ...h("#000000", "#FFFFFF", "#007A3D"),
      hoist("#CE1126", 0.5),
      star("#FFFFFF", 0.17, 0.5, 0.07),
    ],
  ],
  [
    "KZ",
    "Kazakhstan",
    [fill("#00AFCA"), rect("#FEC50C", 0.05, 0, 0.05, 1), disc("#FEC50C", 0.55, 0.45, 0.18)],
  ],
  ["KE", "Kenya", h(["#000000", 6], "#FFFFFF", ["#BB0000", 6], "#FFFFFF", ["#006600", 6])],
  ["XK", "Kosovo", [fill("#244AA5"), disc("#D0A650", 0.5, 0.55, 0.2)]],
  [
    "KW",
    "Kuwait",
    [
      ...h("#007A3D", "#FFFFFF", "#CE1126"),
      poly("#000000", [0, 0], [0.28, 0.33], [0.28, 0.67], [0, 1]),
    ],
  ],
  ["LA", "Laos", [...h("#CE1126", ["#002868", 2], "#CE1126"), disc("#FFFFFF", 0.5, 0.5, 0.2)]],
  ["LV", "Latvia", h(["#9E3039", 2], "#FFFFFF", ["#9E3039", 2])],
  [
    "LB",
    "Lebanon",
    [
      ...h("#ED1C24", ["#FFFFFF", 2], "#ED1C24"),
      poly("#00A651", [0.5, 0.3], [0.68, 0.66], [0.32, 0.66]),
    ],
  ],
  [
    "LY",
    "Libya",
    [
      ...h("#E70013", ["#000000", 2], "#239E46"),
      ...crescent("#FFFFFF", "#000000", 0.47, 0.5, 0.16),
    ],
  ],
  ["LI", "Liechtenstein", h("#002B7F", "#CE1126")],
  ["LT", "Lithuania", h("#FDB913", "#006A44", "#C1272D")],
  ["LU", "Luxembourg", h("#EF3340", "#FFFFFF", "#00A3E0")],
  [
    "MY",
    "Malaysia",
    [
      ...stripes(14, "#CC0001", "#FFFFFF"),
      rect("#010066", 0, 0, 0.5, 8 / 14),
      ...crescent("#FFCC00", "#010066", 0.18, 0.29, 0.15),
      star("#FFCC00", 0.36, 0.29, 0.09),
    ],
  ],
  ["ML", "Mali", v("#14B53A", "#FCD116", "#CE1126")],
  ["MT", "Malta", [...v("#FFFFFF", "#CF142B"), rect("#A0A0A0", 0.06, 0.06, 0.12, 0.12)]],
  ["MX", "Mexico", v("#006847", "#FFFFFF", "#CE1126")],
  ["MD", "Moldova", v("#0046AE", "#FFD200", "#CC092F")],
  ["MC", "Monaco", h("#CE1126", "#FFFFFF")],
  [
    "MN",
    "Mongolia",
    [...v("#C4272F", "#015197", "#C4272F"), rect("#F9CF02", 0.12, 0.25, 0.09, 0.5)],
  ],
  [
    "ME",
    "Montenegro",
    [fill("#D4AF37"), rect("#C40308", 0.06, 0.06, 0.88, 0.88), disc("#D4AF37", 0.5, 0.5, 0.18)],
  ],
  ["MA", "Morocco", [fill("#C1272D"), star("#006233", 0.5, 0.5, 0.28)]],
  ["MM", "Myanmar", [...h("#FECB00", "#34B233", "#EA2839"), star("#FFFFFF", 0.5, 0.52, 0.32)]],
  [
    "NP",
    "Nepal",
    [
      fill("#FFFFFF"),
      poly("#003893", [0, 0], [0.92, 0.46], [0.36, 0.46], [0.92, 1], [0, 1]),
      poly("#DC143C", [0.06, 0.1], [0.74, 0.41], [0.22, 0.51], [0.76, 0.94], [0.06, 0.94]),
    ],
  ],
  ["NL", "Netherlands", h("#AE1C28", "#FFFFFF", "#21468B")],
  [
    "NZ",
    "New Zealand",
    [
      fill("#012169"),
      ...unionJack(0, 0, 0.5, 0.5),
      star("#C8102E", 0.76, 0.22, 0.07),
      star("#C8102E", 0.64, 0.48, 0.07),
      star("#C8102E", 0.88, 0.42, 0.06),
      star("#C8102E", 0.76, 0.82, 0.08),
    ],
  ],
  ["NI", "Nicaragua", h("#0067C6", "#FFFFFF", "#0067C6")],
  ["NG", "Nigeria", v("#008751", "#FFFFFF", "#008751")],
  [
    "MK",
    "North Macedonia",
    [
      fill("#D20000"),
      ...plus("#FFE600", 0.1),
      ...saltire("#FFE600", 0.1),
      disc("#FFE600", 0.5, 0.5, 0.15),
    ],
  ],
  ["NO", "Norway", [fill("#BA0C2F"), ...nordic("#FFFFFF", 0.22), ...nordic("#00205B", 0.11)]],
  ["OM", "Oman", [...h("#FFFFFF", "#DB161B", "#008000"), rect("#DB161B", 0, 0, 0.3, 1)]],
  [
    "PK",
    "Pakistan",
    [
      fill("#01411C"),
      rect("#FFFFFF", 0, 0, 0.25, 1),
      ...crescent("#FFFFFF", "#01411C", 0.6, 0.52, 0.24),
      star("#FFFFFF", 0.74, 0.4, 0.07),
    ],
  ],
  ["PS", "Palestine", [...h("#000000", "#FFFFFF", "#009736"), hoist("#EE2A35", 0.45)]],
  [
    "PA",
    "Panama",
    [
      fill("#FFFFFF"),
      rect("#DA121A", 0.5, 0, 0.5, 0.5),
      rect("#072357", 0, 0.5, 0.5, 0.5),
      star("#072357", 0.25, 0.25, 0.12),
      star("#DA121A", 0.75, 0.75, 0.12),
    ],
  ],
  ["PY", "Paraguay", h("#D52B1E", "#FFFFFF", "#0038A8")],
  ["PE", "Peru", v("#D91023", "#FFFFFF", "#D91023")],
  [
    "PH",
    "Philippines",
    [...h("#0038A8", "#CE1126"), hoist("#FFFFFF", 0.5), disc("#FCD116", 0.16, 0.5, 0.08)],
  ],
  ["PL", "Poland", h("#FFFFFF", "#DC143C")],
  ["PT", "Portugal", [...v(["#046A38", 2], ["#DA291C", 3]), disc("#FFE900", 0.4, 0.5, 0.2)]],
  [
    "PR",
    "Puerto Rico",
    [...stripes(5, "#ED0000", "#FFFFFF"), hoist("#0050F0", 0.5), star("#FFFFFF", 0.17, 0.5, 0.1)],
  ],
  ["QA", "Qatar", [fill("#8A1538"), serrated("#FFFFFF", 9, 0.28, 0.4)]],
  ["RO", "Romania", v("#002B7F", "#FCD116", "#CE1126")],
  ["RU", "Russia", h("#FFFFFF", "#0039A6", "#D52B1E")],
  ["RW", "Rwanda", [...h(["#00A1DE", 2], "#FAD201", "#20603D"), disc("#E5BE01", 0.8, 0.25, 0.1)]],
  ["SA", "Saudi Arabia", [fill("#006C35"), rect("#FFFFFF", 0.2, 0.68, 0.6, 0.05)]],
  ["GB-SCT", "Scotland", [fill("#005EB8"), ...saltire("#FFFFFF", 0.18)]],
  ["SN", "Senegal", [...v("#00853F", "#FDEF42", "#E31B23"), star("#00853F", 0.5, 0.5, 0.14)]],
  ["RS", "Serbia", h("#C6363C", "#0C4076", "#FFFFFF")],
  [
    "SG",
    "Singapore",
    [...h("#EF3340", "#FFFFFF"), ...crescent("#FFFFFF", "#EF3340", 0.2, 0.25, 0.14, 0.35)],
  ],
  ["SK", "Slovakia", h("#FFFFFF", "#0B4EA2", "#EE1C25")],
  ["SI", "Slovenia", h("#FFFFFF", "#005DA4", "#ED1C24")],
  ["SO", "Somalia", [fill("#4189DD"), star("#FFFFFF", 0.5, 0.5, 0.3)]],
  [
    "ZA",
    "South Africa",
    [
      ...h("#E03C31", "#001489"),
      line("#FFFFFF", 0, 0, 0.45, 0.5, 0.3),
      line("#FFFFFF", 0, 1, 0.45, 0.5, 0.3),
      rect("#FFFFFF", 0.4, 0.35, 0.6, 0.3),
      line("#007749", 0, 0, 0.45, 0.5, 0.2),
      line("#007749", 0, 1, 0.45, 0.5, 0.2),
      rect("#007749", 0.4, 0.4, 0.6, 0.2),
      poly("#FFB612", [0, 0.1], [0.36, 0.5], [0, 0.9]),
      poly("#000000", [0, 0.18], [0.28, 0.5], [0, 0.82]),
    ],
  ],
  [
    "KR",
    "South Korea",
    [
      fill("#FFFFFF"),
      disc("#CD2E3A", 0.5, 0.5, 0.24),
      disc("#0047A0", 0.5, 0.58, 0.16),
      rect("#000000", 0.08, 0.1, 0.14, 0.1),
      rect("#000000", 0.78, 0.1, 0.14, 0.1),
      rect("#000000", 0.08, 0.8, 0.14, 0.1),
      rect("#000000", 0.78, 0.8, 0.14, 0.1),
    ],
  ],
  ["ES", "Spain", h("#AA151B", ["#F1BF00", 2], "#AA151B")],
  [
    "LK",
    "Sri Lanka",
    [
      fill("#FFB700"),
      rect("#005F56", 0.05, 0.05, 0.12, 0.9),
      rect("#FF5B00", 0.17, 0.05, 0.12, 0.9),
      rect("#8D153A", 0.33, 0.05, 0.62, 0.9),
    ],
  ],
  ["SD", "Sudan", [...h("#D21034", "#FFFFFF", "#000000"), hoist("#007229", 0.45)]],
  ["SE", "Sweden", [fill("#006AA7"), ...nordic("#FECC00")]],
  ["CH", "Switzerland", [fill("#DA291C"), ...plus("#FFFFFF", 0.19, 0.62)]],
  [
    "SY",
    "Syria",
    [
      ...h("#007A3D", "#FFFFFF", "#000000"),
      star("#CE1126", 0.25, 0.5, 0.09),
      star("#CE1126", 0.5, 0.5, 0.09),
      star("#CE1126", 0.75, 0.5, 0.09),
    ],
  ],
  [
    "TW",
    "Taiwan",
    [fill("#FE0000"), rect("#000095", 0, 0, 0.5, 0.5), disc("#FFFFFF", 0.25, 0.25, 0.12)],
  ],
  [
    "TZ",
    "Tanzania",
    [
      poly("#1EB53A", [0, 0], [1, 0], [0, 1]),
      poly("#00A3DD", [1, 0], [1, 1], [0, 1]),
      line("#FCD116", 0, 1, 1, 0, 0.38),
      line("#000000", 0, 1, 1, 0, 0.26),
    ],
  ],
  ["TH", "Thailand", h("#A51931", "#F4F5F8", ["#2D2A4A", 2], "#F4F5F8", "#A51931")],
  [
    "TT",
    "Trinidad and Tobago",
    [fill("#CE1126"), line("#FFFFFF", 0, 0, 1, 1, 0.34), line("#000000", 0, 0, 1, 1, 0.24)],
  ],
  [
    "TN",
    "Tunisia",
    [
      fill("#E70013"),
      disc("#FFFFFF", 0.5, 0.5, 0.26),
      ...crescent("#E70013", "#FFFFFF", 0.48, 0.5, 0.18),
    ],
  ],
  [
    "TR",
    "Türkiye",
    [
      fill("#E30A17"),
      ...crescent("#FFFFFF", "#E30A17", 0.4, 0.5, 0.25),
      star("#FFFFFF", 0.67, 0.5, 0.1),
    ],
  ],
  [
    "UG",
    "Uganda",
    [
      ...h("#000000", "#FCDC04", "#D90000", "#000000", "#FCDC04", "#D90000"),
      disc("#FFFFFF", 0.5, 0.5, 0.2),
    ],
  ],
  ["UA", "Ukraine", h("#0057B7", "#FFD700")],
  [
    "AE",
    "United Arab Emirates",
    [...h("#00732F", "#FFFFFF", "#000000"), rect("#FF0000", 0, 0, 0.26, 1)],
  ],
  ["GB", "United Kingdom", unionJack()],
  [
    "US",
    "United States",
    [
      ...stripes(13, "#B22234", "#FFFFFF"),
      rect("#3C3B6E", 0, 0, 0.45, 7 / 13),
      ...[0.1, 0.225, 0.35].flatMap((x) =>
        [0.12, 0.27, 0.42].map((y) => disc("#FFFFFF", x, y, 0.028)),
      ),
    ],
  ],
  [
    "UY",
    "Uruguay",
    [
      ...stripes(9, "#FFFFFF", "#0038A8"),
      rect("#FFFFFF", 0, 0, 0.45, 5 / 9),
      disc("#FCD116", 0.22, 0.27, 0.13),
    ],
  ],
  ["UZ", "Uzbekistan", h(["#0099B5", 10], "#CE1126", ["#FFFFFF", 10], "#CE1126", ["#1EB53A", 10])],
  ["VE", "Venezuela", h("#FFCC00", "#00247D", "#CF142B")],
  ["VN", "Vietnam", [fill("#DA251D"), star("#FFFF00", 0.5, 0.52, 0.3)]],
  ["GB-WLS", "Wales", [...h("#FFFFFF", "#00AB39"), disc("#C8102E", 0.5, 0.5, 0.24)]],
  ["YE", "Yemen", h("#CE1126", "#FFFFFF", "#000000")],
  [
    "ZW",
    "Zimbabwe",
    [
      ...h("#319208", "#FFD200", "#DE2010", "#000000", "#DE2010", "#FFD200", "#319208"),
      hoist("#000000", 0.5),
      poly("#FFFFFF", [0, 0.04], [0.44, 0.5], [0, 0.96]),
      star("#DE2010", 0.16, 0.5, 0.09),
    ],
  ],
];

export const LOGO_THEMES: LogoTheme[] = [
  ...PRIDE.map(
    ([id, name, shapes]): LogoTheme => ({ id: `pride:${id}`, name, group: "pride", shapes }),
  ),
  ...CAUSES.map(
    ([id, name, shapes]): LogoTheme => ({ id: `cause:${id}`, name, group: "cause", shapes }),
  ),
  ...COUNTRY_FLAGS.map(
    ([code, name, shapes]): LogoTheme => ({ id: `flag:${code}`, name, group: "country", shapes }),
  ),
];

const BY_ID = new Map(LOGO_THEMES.map((t) => [t.id, t]));

/** The stored theme, or null for the standard logo (including ids we no longer ship). */
export function logoTheme(id: string | null | undefined): LogoTheme | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/** Tile geometry: a 32-unit square, matching the 32px header tile. */
export const TILE = 32;
export const TILE_RADIUS = 8;

/** Five-point star polygon points, in tile units. */
export function starPoints(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.4 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    pts.push(`${round(x + Math.cos(a) * radius)},${round(y + Math.sin(a) * radius)}`);
  }
  return pts.join(" ");
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One shape as SVG attributes in tile units — shared by the React tile and the favicon. */
export function shapeElement(s: FlagShape): {
  tag: "rect" | "polygon" | "circle" | "line";
  attrs: Record<string, string | number>;
} {
  const k = TILE;
  switch (s.kind) {
    case "rect":
      // A hair of overlap so adjacent bands never show an anti-aliased seam.
      return {
        tag: "rect",
        attrs: {
          x: round(s.x * k),
          y: round(s.y * k),
          width: round(s.w * k + 0.05),
          height: round(s.h * k + 0.05),
          fill: s.color,
        },
      };
    case "poly":
      return {
        tag: "polygon",
        attrs: {
          points: s.points.map(([x, y]) => `${round(x * k)},${round(y * k)}`).join(" "),
          fill: s.color,
        },
      };
    case "disc":
      return {
        tag: "circle",
        attrs: { cx: round(s.x * k), cy: round(s.y * k), r: round(s.r * k), fill: s.color },
      };
    case "star":
      return {
        tag: "polygon",
        attrs: { points: starPoints(s.x * k, s.y * k, s.r * k), fill: s.color },
      };
    case "line":
      return {
        tag: "line",
        attrs: {
          x1: round(s.x1 * k),
          y1: round(s.y1 * k),
          x2: round(s.x2 * k),
          y2: round(s.y2 * k),
          stroke: s.color,
          "stroke-width": round(s.w * k),
        },
      };
  }
}

/** Lucide's briefcase, placed in the middle 16 units of the tile. */
export const BRIEFCASE_PATHS = [
  "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  "M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
];
export const BRIEFCASE_TRANSFORM = "translate(8 8) scale(0.6667)";

/** A standalone SVG of the themed tile, for the browser-tab icon. */
export function logoThemeSvg(theme: LogoTheme): string {
  const shapes = theme.shapes
    .map((s) => {
      const { tag, attrs } = shapeElement(s);
      const a = Object.entries(attrs)
        .map(([key, val]) => `${key}="${val}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
  const icon = BRIEFCASE_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}">` +
    `<defs><clipPath id="t"><rect width="${TILE}" height="${TILE}" rx="${TILE_RADIUS}"/></clipPath></defs>` +
    `<g clip-path="url(#t)">${shapes}</g>` +
    `<g transform="${BRIEFCASE_TRANSFORM}" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#000" stroke-opacity="0.55" stroke-width="5">${icon}</g>` +
    `<g stroke="#fff" stroke-width="2.4">${icon}</g></g></svg>`
  );
}
