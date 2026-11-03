import { describe, expect, test } from "bun:test";
import {
  GENDER_OPTIONS,
  PREFER_NOT_TO_SAY,
  PRONOUN_OPTIONS,
  pronounsLabel,
  toggleGender,
  togglePronoun,
} from "./gender";

describe("options", () => {
  test("ids are unique and fit the columns' check constraints", () => {
    const ids = [...GENDER_OPTIONS.map((o) => o.id), PREFER_NOT_TO_SAY];
    expect(new Set(ids).size).toBe(ids.length);
    const pronounIds = PRONOUN_OPTIONS.map((o) => o.id);
    expect(new Set(pronounIds).size).toBe(pronounIds.length);
    for (const id of [...ids, ...pronounIds]) expect(/^[a-z-]{1,32}$/.test(id)).toBe(true);
    expect(ids.length <= 80).toBe(true);
    expect(pronounIds.length <= 20).toBe(true);
  });
});

describe("toggleGender", () => {
  test("allows several identities at once", () => {
    expect(toggleGender(toggleGender([], "trans-woman"), "non-binary").join()).toBe(
      "trans-woman,non-binary",
    );
    expect(toggleGender(["woman", "agender"], "woman").join()).toBe("agender");
  });

  test("keeps 'prefer not to say' exclusive", () => {
    expect(toggleGender(["woman", "two-spirit"], PREFER_NOT_TO_SAY).join()).toBe(PREFER_NOT_TO_SAY);
    expect(toggleGender([PREFER_NOT_TO_SAY], "man").join()).toBe("man");
    expect(toggleGender([PREFER_NOT_TO_SAY], PREFER_NOT_TO_SAY).length).toBe(0);
  });

  test("drops ids the app no longer knows", () => {
    expect(toggleGender(["retired-id", "woman"], "man").join()).toBe("woman,man");
    expect(togglePronoun(["retired-id"], "they").join()).toBe("they");
  });
});

describe("pronounsLabel", () => {
  test("formats one set in full and several by subject", () => {
    expect(pronounsLabel(["he"])).toBe("he/him");
    expect(pronounsLabel(["she", "they"])).toBe("she/they");
    expect(pronounsLabel(["they", "any"])).toBe("they/them, any pronouns");
    expect(pronounsLabel([], "ve/ver")).toBe("ve/ver");
    expect(pronounsLabel([], "  ")).toBeNull();
    expect(pronounsLabel(null)).toBeNull();
  });
});
