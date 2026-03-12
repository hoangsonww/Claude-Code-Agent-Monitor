import { describe, it, expect, vi, afterEach } from "vitest";
import { formatMs, formatDuration, timeAgo, truncate, fmt, fmtCost } from "../format";

describe("formatMs", () => {
  it("should return 0s for negative values", () => {
    expect(formatMs(-1000)).toBe("0s");
    expect(formatMs(-1)).toBe("0s");
  });

  it("should return 0s for zero", () => {
    expect(formatMs(0)).toBe("0s");
  });

  it("should format seconds only", () => {
    expect(formatMs(1000)).toBe("1s");
    expect(formatMs(5000)).toBe("5s");
    expect(formatMs(59000)).toBe("59s");
  });

  it("should format minutes and seconds", () => {
    expect(formatMs(60000)).toBe("1m 0s");
    expect(formatMs(90000)).toBe("1m 30s");
    expect(formatMs(125000)).toBe("2m 5s");
    expect(formatMs(3599000)).toBe("59m 59s");
  });

  it("should format hours and minutes", () => {
    expect(formatMs(3600000)).toBe("1h 0m");
    expect(formatMs(5400000)).toBe("1h 30m");
    expect(formatMs(7260000)).toBe("2h 1m");
  });

  it("should truncate sub-second precision", () => {
    expect(formatMs(1500)).toBe("1s");
    expect(formatMs(999)).toBe("0s");
  });
});

describe("formatDuration", () => {
  it("should compute duration between two ISO strings", () => {
    const start = "2026-03-05T10:00:00.000Z";
    const end = "2026-03-05T10:05:30.000Z";
    expect(formatDuration(start, end)).toBe("5m 30s");
  });

  it("should handle zero duration", () => {
    const t = "2026-03-05T10:00:00.000Z";
    expect(formatDuration(t, t)).toBe("0s");
  });

  it("should handle long durations", () => {
    const start = "2026-03-05T10:00:00.000Z";
    const end = "2026-03-05T12:30:00.000Z";
    expect(formatDuration(start, end)).toBe("2h 30m");
  });
});

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for recent times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T10:00:30Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("just now");
  });

  it("should return minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T10:05:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("5m ago");
  });

  it("should return hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T13:00:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("3h ago");
  });

  it("should return days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T10:00:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("2d ago");
  });
});

describe("truncate", () => {
  it("should return string unchanged when shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should return string unchanged when exactly max length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should truncate and add ellipsis when longer than max", () => {
    expect(truncate("hello world", 8)).toBe("hello w\u2026");
  });

  it("should handle max of 1", () => {
    expect(truncate("hello", 1)).toBe("\u2026");
  });

  it("should handle empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("fmt", () => {
  it("should return raw number below 1000", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(999)).toBe("999");
  });

  it("should format thousands with K suffix", () => {
    expect(fmt(1000)).toBe("1.0K");
    expect(fmt(1957)).toBe("2.0K");
    expect(fmt(21986)).toBe("22.0K");
  });

  it("should format millions with M suffix", () => {
    expect(fmt(1_000_000)).toBe("1.0M");
    expect(fmt(1_009_500_000)).toBe("1.0B");
  });

  it("should format billions with B suffix", () => {
    expect(fmt(1_000_000_000)).toBe("1.0B");
    expect(fmt(2_500_000_000)).toBe("2.5B");
  });
});

describe("fmtCost", () => {
  it("should format small costs with dollar sign", () => {
    expect(fmtCost(0)).toBe("$0.00");
    expect(fmtCost(833.97)).toBe("$833.97");
    expect(fmtCost(999.99)).toBe("$999.99");
  });

  it("should format thousands with K suffix", () => {
    expect(fmtCost(1000)).toBe("$1.00K");
    expect(fmtCost(2500.5)).toBe("$2.50K");
  });

  it("should format millions with M suffix", () => {
    expect(fmtCost(1_000_000)).toBe("$1.00M");
  });
});
