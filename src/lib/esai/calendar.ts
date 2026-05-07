import type { CalendarCategory, CalendarEvent } from "@/types/esai";

type CalendarFilters = {
  query?: string;
  category?: CalendarCategory | "All";
  tag?: string;
};

export function filterCalendarEvents(events: CalendarEvent[], filters: CalendarFilters) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const category = filters.category ?? "All";
  const tag = filters.tag ?? "All";

  return events.filter((event) => {
    const matchesQuery =
      !query ||
      event.title.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query);
    const matchesCategory = category === "All" || event.category === category;
    const matchesTag = tag === "All" || event.tags.includes(tag);

    return matchesQuery && matchesCategory && matchesTag;
  });
}

export function getUpcomingEvents(events: CalendarEvent[], fromDate: Date, limit = 5) {
  const start = fromDate.getTime();

  return [...events]
    .filter((event) => new Date(event.startTime).getTime() >= start)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit);
}

export function getEventsForDate(events: CalendarEvent[], date: Date) {
  const key = toDateKey(date);
  return events.filter((event) => toDateKey(new Date(event.startTime)) === key);
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

