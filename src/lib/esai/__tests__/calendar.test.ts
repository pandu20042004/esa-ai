import { describe, expect, it } from "vitest";

import { filterCalendarEvents, getUpcomingEvents } from "@/lib/esai/calendar";
import type { CalendarEvent } from "@/types/esai";

const events: CalendarEvent[] = [
  {
    id: "ev-asset",
    title: "Asset caption draft",
    description: "Prepare assets.",
    startTime: "2026-05-08T15:00:00.000Z",
    endTime: "2026-05-08T16:00:00.000Z",
    color: "neutral",
    category: "Asset",
    tags: ["asset"],
    source: "user",
  },
  {
    id: "ev-ideation",
    title: "Ideation checkpoint",
    description: "Select angle.",
    startTime: "2026-05-11T09:30:00.000Z",
    endTime: "2026-05-11T10:30:00.000Z",
    color: "accent",
    category: "Stage",
    tags: ["team"],
    source: "agent",
  },
  {
    id: "ev-research",
    title: "Research source review",
    description: "Verify citations.",
    startTime: "2026-05-13T14:00:00.000Z",
    endTime: "2026-05-13T15:30:00.000Z",
    color: "warn",
    category: "Review",
    tags: ["urgent"],
    source: "review",
  },
];

describe("calendar filtering", () => {
  it("filters events by search, category, and tag", () => {
    const results = filterCalendarEvents(events, {
      query: "research",
      category: "Review",
      tag: "urgent",
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Research source review");
  });

  it("returns upcoming events sorted from the selected date", () => {
    const results = getUpcomingEvents(events, new Date("2026-05-07T00:00:00.000Z"), 3);

    expect(results.map((event) => event.title)).toEqual([
      "Asset caption draft",
      "Ideation checkpoint",
      "Research source review",
    ]);
  });
});
