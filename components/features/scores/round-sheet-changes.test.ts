import { describe, expect, it } from "vitest";

import type { RoundSheetFormValues } from "@/app/(app)/rounds/schema";
import { toRoundSheetChanges } from "./round-sheet-changes";

function sheet(
  overrides: Partial<RoundSheetFormValues> = {},
): RoundSheetFormValues {
  return {
    roundId: 7,
    teeId: 1,
    playerIndexOverride: "",
    scores: Array.from({ length: 18 }, (_, index) => ({
      hole: index + 1,
      strokes: index < 4 ? 4 : "",
      putts: index < 4 ? 2 : "",
    })),
    greenies: [
      { hole: 3, feet: 10, inches: 0, action: "upsert" },
      { hole: 7, feet: "", inches: "", action: "none" },
      { hole: 12, feet: 4, inches: 6, action: "upsert" },
    ],
    ...overrides,
  };
}

function edit(
  update: (values: RoundSheetFormValues) => void,
): RoundSheetFormValues {
  const values = structuredClone(sheet());
  update(values);
  return values;
}

describe("round sheet changes", () => {
  it("sends nothing when nothing changed", () => {
    expect(toRoundSheetChanges(sheet(), sheet(), { canManage: true })).toEqual(
      { scorecard: null, settings: null },
    );
  });

  it("sends only the fields of the holes that changed", () => {
    const values = edit((v) => {
      v.scores[2].strokes = 5;
      v.scores[9].putts = 1;
    });

    expect(
      toRoundSheetChanges(sheet(), values, { canManage: true }).scorecard,
    ).toEqual({
      roundId: 7,
      scores: [
        { hole: 3, strokes: 5 },
        { hole: 10, putts: 1 },
      ],
      greenies: [],
    });
  });

  it("clears a field the user emptied", () => {
    const values = edit((v) => {
      v.scores[3].putts = "";
    });

    expect(
      toRoundSheetChanges(sheet(), values, { canManage: false }).scorecard
        ?.scores,
    ).toEqual([{ hole: 4, putts: null }]);
  });

  it("sends only the Greenies that were added, moved or removed", () => {
    const values = edit((v) => {
      v.greenies[0] = { hole: 3, feet: "", inches: "", action: "delete" };
      v.greenies[1] = { hole: 7, feet: 2, inches: 1, action: "upsert" };
    });

    expect(
      toRoundSheetChanges(sheet(), values, { canManage: false }).scorecard
        ?.greenies,
    ).toEqual([
      { hole: 3, distance: null },
      { hole: 7, distance: { feet: 2, inches: 1 } },
    ]);
  });

  it("sends a moved Greenie distance", () => {
    const values = edit((v) => {
      v.greenies[2].inches = 7;
    });

    expect(
      toRoundSheetChanges(sheet(), values, { canManage: false }).scorecard
        ?.greenies,
    ).toEqual([{ hole: 12, distance: { feet: 4, inches: 7 } }]);
  });

  it("sends a settings change with only the tee or override that changed", () => {
    expect(
      toRoundSheetChanges(sheet(), sheet({ teeId: 2 }), { canManage: true }),
    ).toEqual({ scorecard: null, settings: { roundId: 7, teeId: 2 } });
    expect(
      toRoundSheetChanges(
        sheet({ playerIndexOverride: 8.4 }),
        sheet({ playerIndexOverride: "" }),
        { canManage: true },
      ).settings,
    ).toEqual({ roundId: 7, playerIndexOverride: "" });
  });

  it("never sends settings for someone who can't manage the Round", () => {
    expect(
      toRoundSheetChanges(sheet(), sheet({ teeId: 2 }), { canManage: false })
        .settings,
    ).toBeNull();
  });
});
