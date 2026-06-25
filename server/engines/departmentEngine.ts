export function getResponsibleDepartment(affectedAsset: string): string {
  const asset = (affectedAsset || "").toLowerCase();

  switch (asset) {
    case "road":
      return "Roads & Infrastructure Department";
    case "streetlight":
      return "Electrical Maintenance Department";
    case "footpath":
      return "Urban Development Department";
    case "water_pipe":
    case "drainage":
      return "Water & Drainage Department";
    case "waste_bin":
      return "Solid Waste Management Department";
    case "electrical":
      return "Electrical Maintenance Department";
    case "other":
    default:
      return "Municipal General Department";
  }
}
