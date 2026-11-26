export const severities = ["info", "minor", "major"] as const;
export const incidentCategories = [
  "operations",
  "infrastructure",
  "vehicle",
  "weather",
  "event",
  "other",
] as const;
export const reportCategories = [
  "overcrowding",
  "delay",
  "cleanliness",
  "accessibility",
  "equipment",
  "station",
  "disruption",
  "lost-property",
  "other",
] as const;
export const reportStatuses = [
  "pending",
  "confirmed",
  "rejected",
  "duplicate",
  "resolved",
] as const;
