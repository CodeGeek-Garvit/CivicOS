export function getResponseSLA(priorityLevel: string): string {
  const level = (priorityLevel || "").toUpperCase();

  switch (level) {
    case "CRITICAL":
      return "24 hours";
    case "HIGH":
      return "72 hours";
    case "MEDIUM":
      return "7 days";
    case "LOW":
    default:
      return "14 days";
  }
}
