import { describe, expect, test } from "bun:test";
import { LOGO_THEMES, logoTheme, logoThemeSvg } from "./logo-theme";

describe("LOGO_THEMES", () => {
  test("ids and names are unique, and every id fits the column's check constraint", () => {
    const ids = LOGO_THEMES.map((t) => t.id);
    const names = LOGO_THEMES.map((t) => t.name);
    expect(new Set(ids).size).toBe(ids.length);
    // The country picker selects by name, so names must be unique too.
    expect(new Set(names).size).toBe(names.length);
    for (const id of ids) expect(/^[a-z]+:[A-Za-z0-9-]{1,32}$/.test(id)).toBe(true);
  });

  test("covers the flags people asked for", () => {
    for (const id of ["flag:UA", "flag:PS", "flag:IL", "pride:rainbow", "cause:blm"]) {
      expect(logoTheme(id)?.id).toBe(id);
    }
  });

  test("every shape uses a hex colour", () => {
    for (const t of LOGO_THEMES) {
      expect(t.shapes.length > 0).toBe(true);
      for (const s of t.shapes) expect(/^#[0-9A-F]{6}$/i.test(s.color)).toBe(true);
    }
  });
});

describe("logoTheme", () => {
  test("falls back to the standard logo for nothing or an unknown id", () => {
    expect(logoTheme(null)).toBeNull();
    expect(logoTheme("")).toBeNull();
    expect(logoTheme("flag:ZZ")).toBeNull();
  });
});

describe("logoThemeSvg", () => {
  test("renders a standalone svg with no NaN coordinates", () => {
    for (const t of LOGO_THEMES) {
      const svg = logoThemeSvg(t);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(/NaN|undefined/.test(svg)).toBe(false);
    }
  });
});
