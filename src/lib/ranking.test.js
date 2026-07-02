import { describe, it, expect } from "vitest";
import { rankExercise, overallRank, isRanked, rankedExercises } from "./ranking.js";

describe("isRanked", () => {
  it("returns true for known exercises", () => {
    expect(isRanked("Press de banca con mancuernas")).toBe(true);
  });

  it("returns false for unknown exercises", () => {
    expect(isRanked("Curl de bíceps con polea")).toBe(false);
  });
});

describe("rankExercise", () => {
  it("returns null when exercise is unknown", () => {
    expect(rankExercise("fake", 100, 80, "male")).toBeNull();
  });

  it("returns null when oneRM or bodyweight is missing", () => {
    expect(rankExercise("Press de banca con mancuernas", null, 80, "male")).toBeNull();
  });

  it("returns Bronce for low ratio", () => {
    const result = rankExercise("Press de banca con mancuernas", 10, 80, "male");
    expect(result.tier.key).toBe("bronce");
    expect(result.tierIndex).toBe(0);
  });

  it("returns higher tiers for stronger ratios", () => {
    const result = rankExercise("Press de banca con mancuernas", 50, 80, "male");
    expect(result.tier.key).not.toBe("bronce");
    expect(result.ratio).toBeGreaterThan(0.6);
  });

  it("adjusts thresholds for female", () => {
    const male = rankExercise("Press de banca con mancuernas", 20, 80, "male");
    const female = rankExercise("Press de banca con mancuernas", 20, 80, "female");
    expect(female.tierIndex).toBeGreaterThanOrEqual(male.tierIndex);
  });
});

describe("overallRank", () => {
  it("returns null for empty array", () => {
    expect(overallRank([])).toBeNull();
  });

  it("averages tier indices", () => {
    const results = [
      { tierIndex: 0 },
      { tierIndex: 2 },
      { tierIndex: 4 },
    ];
    const rank = overallRank(results);
    expect(rank.tierIndex).toBe(2);
    expect(rank.count).toBe(3);
  });
});

describe("rankedExercises", () => {
  it("returns non-empty array", () => {
    const list = rankedExercises();
    expect(list.length).toBeGreaterThan(0);
  });
});
