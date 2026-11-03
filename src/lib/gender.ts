/**
 * Gender identities and pronouns a user can pick on the account page. Both are
 * multi-select: people often hold more than one (e.g. "Trans woman" and
 * "Non-binary", or "she/her" and "they/them"). Ids are stored in
 * `profiles.gender_identities` / `profiles.pronouns`, so never rename one —
 * add a new id instead. Free-text descriptions cover anything not listed.
 */

export type GenderGroup = "common" | "beyond" | "cultural";

export type GenderOption = { id: string; label: string; group: GenderGroup; hint?: string };

/** Exclusive choice: picking it clears everything else, and vice versa. */
export const PREFER_NOT_TO_SAY = "prefer-not-to-say";

export const GENDER_GROUPS: { id: GenderGroup; label: string }[] = [
  { id: "common", label: "Identities" },
  { id: "beyond", label: "Beyond the binary" },
  { id: "cultural", label: "Cultural & Indigenous identities" },
];

export const GENDER_OPTIONS: GenderOption[] = [
  { id: "woman", label: "Woman", group: "common" },
  { id: "man", label: "Man", group: "common" },
  { id: "non-binary", label: "Non-binary", group: "common" },
  { id: "transgender", label: "Transgender", group: "common" },
  { id: "trans-woman", label: "Trans woman", group: "common" },
  { id: "trans-man", label: "Trans man", group: "common" },
  { id: "cisgender", label: "Cisgender", group: "common" },
  { id: "intersex", label: "Intersex", group: "common" },
  { id: "genderqueer", label: "Genderqueer", group: "common" },
  { id: "genderfluid", label: "Genderfluid", group: "common" },
  { id: "agender", label: "Agender", group: "common" },
  { id: "questioning", label: "Questioning", group: "common" },

  { id: "bigender", label: "Bigender", group: "beyond" },
  { id: "trigender", label: "Trigender", group: "beyond" },
  { id: "pangender", label: "Pangender", group: "beyond" },
  { id: "polygender", label: "Polygender", group: "beyond" },
  { id: "demigirl", label: "Demigirl", group: "beyond" },
  { id: "demiboy", label: "Demiboy", group: "beyond" },
  { id: "demigender", label: "Demigender", group: "beyond" },
  { id: "androgyne", label: "Androgyne", group: "beyond" },
  { id: "neutrois", label: "Neutrois", group: "beyond" },
  { id: "graygender", label: "Graygender", group: "beyond" },
  { id: "maverique", label: "Maverique", group: "beyond" },
  { id: "aliagender", label: "Aliagender", group: "beyond" },
  { id: "xenogender", label: "Xenogender", group: "beyond" },
  { id: "genderflux", label: "Genderflux", group: "beyond" },
  { id: "transfeminine", label: "Transfeminine", group: "beyond" },
  { id: "transmasculine", label: "Transmasculine", group: "beyond" },
  { id: "gender-non-conforming", label: "Gender non-conforming", group: "beyond" },
  { id: "butch", label: "Butch", group: "beyond" },
  { id: "femme", label: "Femme", group: "beyond" },

  { id: "two-spirit", label: "Two-Spirit", group: "cultural", hint: "Indigenous North America" },
  { id: "hijra", label: "Hijra", group: "cultural", hint: "South Asia" },
  { id: "aravani", label: "Aravani", group: "cultural", hint: "Tamil Nadu" },
  { id: "khawaja-sira", label: "Khawaja sira", group: "cultural", hint: "Pakistan" },
  { id: "fa-afafine", label: "Faʻafafine", group: "cultural", hint: "Samoa" },
  { id: "fa-afatama", label: "Faʻatama", group: "cultural", hint: "Samoa" },
  { id: "fakaleiti", label: "Fakaleitī", group: "cultural", hint: "Tonga" },
  { id: "mahu", label: "Māhū", group: "cultural", hint: "Hawaiʻi & Tahiti" },
  { id: "whakawahine", label: "Whakawāhine", group: "cultural", hint: "Aotearoa" },
  { id: "akava-ine", label: "Akavaʻine", group: "cultural", hint: "Cook Islands" },
  { id: "brotherboy", label: "Brotherboy", group: "cultural", hint: "Aboriginal Australia" },
  { id: "sistergirl", label: "Sistergirl", group: "cultural", hint: "Aboriginal Australia" },
  { id: "muxe", label: "Muxe", group: "cultural", hint: "Oaxaca, Mexico" },
  { id: "travesti", label: "Travesti", group: "cultural", hint: "Latin America" },
  { id: "kathoey", label: "Kathoey", group: "cultural", hint: "Thailand" },
  { id: "waria", label: "Waria", group: "cultural", hint: "Indonesia" },
  { id: "bissu", label: "Bissu", group: "cultural", hint: "Bugis, Indonesia" },
  { id: "bakla", label: "Bakla", group: "cultural", hint: "Philippines" },
  { id: "x-gender", label: "X-gender", group: "cultural", hint: "Japan" },
];

export const PRONOUN_OPTIONS: { id: string; label: string }[] = [
  { id: "she", label: "she/her" },
  { id: "he", label: "he/him" },
  { id: "they", label: "they/them" },
  { id: "xe", label: "xe/xem" },
  { id: "ze-hir", label: "ze/hir" },
  { id: "ze-zir", label: "ze/zir" },
  { id: "fae", label: "fae/faer" },
  { id: "ey", label: "ey/em" },
  { id: "it", label: "it/its" },
  { id: "any", label: "Any pronouns" },
  { id: "name-only", label: "Just my name" },
  { id: "ask", label: "Ask me" },
];

const GENDER_BY_ID = new Map(GENDER_OPTIONS.map((o) => [o.id, o]));
const PRONOUN_BY_ID = new Map(PRONOUN_OPTIONS.map((o) => [o.id, o]));

/**
 * Toggle `id` in a selection, keeping "Prefer not to say" exclusive and the
 * order stable (picked order), with ids the app no longer knows dropped.
 */
export function toggleGender(selected: string[], id: string): string[] {
  if (id === PREFER_NOT_TO_SAY) return selected.includes(id) ? [] : [id];
  const rest = selected.filter((s) => s !== PREFER_NOT_TO_SAY && GENDER_BY_ID.has(s));
  return rest.includes(id) ? rest.filter((s) => s !== id) : [...rest, id];
}

export function togglePronoun(selected: string[], id: string): string[] {
  const rest = selected.filter((s) => PRONOUN_BY_ID.has(s));
  return rest.includes(id) ? rest.filter((s) => s !== id) : [...rest, id];
}

/**
 * Pronouns as one short line, e.g. "she/they" or "he/him" — the form people
 * write in a bio. A single set shows in full; several collapse to their
 * subject forms. Free text is appended as written. Null when nothing is set.
 */
export function pronounsLabel(
  ids: string[] | null | undefined,
  custom?: string | null,
): string | null {
  const known = (ids ?? []).map((id) => PRONOUN_BY_ID.get(id)).filter((o) => o !== undefined);
  const sets = known.filter((o) => o.label.includes("/"));
  const words = known.filter((o) => !o.label.includes("/")).map((o) => o.label.toLowerCase());
  const parts: string[] = [];
  if (sets.length === 1) parts.push(sets[0].label);
  else if (sets.length > 1) parts.push(sets.map((o) => o.label.split("/")[0]).join("/"));
  parts.push(...words);
  const extra = custom?.trim();
  if (extra) parts.push(extra);
  return parts.length ? parts.join(", ") : null;
}

export function genderOption(id: string): GenderOption | undefined {
  return GENDER_BY_ID.get(id);
}
