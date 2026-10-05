import { describe, expect, it } from "vitest";
import {
  completionStreak,
  dateInZone,
  durationLabel,
  monthDays,
  shiftDay,
  summarizeProgress,
  type ProgressEntry,
} from "../../app/lib/progress";
function entry(date: string, completed = 1, minutes = 30): ProgressEntry {
  return {
    id: `${date}-${completed}-${minutes}`,
    date,
    completed,
    minutes,
    title: "Practice",
    kind: "Lab",
    source: "log",
    notes: null,
    skillId: null,
  };
}
describe("progress analytics", () => {
  it("counts unique active days without counting sessions as completed items", () => {
    expect(
      summarizeProgress([
        entry("2026-09-28", 3),
        entry("2026-09-28", 0, 60),
        entry("2026-09-29", 2),
      ]),
    ).toEqual({ completed: 5, minutes: 120, days: 2, sessions: 3 });
    expect(summarizeProgress([])).toEqual({
      completed: 0,
      minutes: 0,
      days: 0,
      sessions: 0,
    });
  });
  it("keeps a streak alive until today ends, deduplicates dates, and breaks at gaps", () => {
    const rows = [
      entry("2026-09-27"),
      entry("2026-09-28"),
      entry("2026-09-28"),
      entry("2026-09-29", 0),
    ];
    expect(completionStreak(rows, "2026-09-29")).toBe(2);
    expect(completionStreak(rows, "2026-09-30")).toBe(0);
    expect(
      completionStreak(
        [...rows, entry("2026-09-29"), entry("2026-09-30")],
        "2026-09-29",
      ),
    ).toBe(3);
  });
  it("handles leap years and year boundaries", () => {
    expect(monthDays("2024-02")).toHaveLength(29);
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(
      completionStreak(
        [entry("2025-12-31"), entry("2026-01-01")],
        "2026-01-01",
      ),
    ).toBe(2);
  });
  it("groups timestamps in the viewer's timezone and preserves timer precision until display", () => {
    expect(dateInZone("2026-09-29T01:00:00Z", "America/Denver")).toBe(
      "2026-09-28",
    );
    expect(dateInZone("2026-09-29T23:00:00Z", "Pacific/Auckland")).toBe(
      "2026-09-30",
    );
    expect(
      summarizeProgress([
        entry("2026-09-28", 0, 0.5),
        entry("2026-09-28", 0, 0.5),
      ]).minutes,
    ).toBe(1);
    expect(durationLabel(90)).toBe("1h 30m");
  });
});
