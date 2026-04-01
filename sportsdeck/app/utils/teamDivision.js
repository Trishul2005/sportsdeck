import { getFullTeamName } from "@/app/utils/teamNames";

const TEAM_DIVISION_LABELS = {
  "atlanta hawks": "Southeast",
  hawks: "Southeast",
  "boston celtics": "Atlantic",
  celtics: "Atlantic",
  "brooklyn nets": "Atlantic",
  nets: "Atlantic",
  "charlotte hornets": "Southeast",
  hornets: "Southeast",
  "chicago bulls": "Central",
  bulls: "Central",
  "cleveland cavaliers": "Central",
  cavaliers: "Central",
  cavs: "Central",
  "dallas mavericks": "Southwest",
  mavericks: "Southwest",
  mavs: "Southwest",
  "denver nuggets": "Northwest",
  nuggets: "Northwest",
  "detroit pistons": "Central",
  pistons: "Central",
  "golden state warriors": "Pacific",
  warriors: "Pacific",
  "houston rockets": "Southwest",
  rockets: "Southwest",
  "indiana pacers": "Central",
  pacers: "Central",
  "la clippers": "Pacific",
  "los angeles clippers": "Pacific",
  clippers: "Pacific",
  "los angeles lakers": "Pacific",
  lakers: "Pacific",
  "memphis grizzlies": "Southwest",
  grizzlies: "Southwest",
  "miami heat": "Southeast",
  heat: "Southeast",
  "milwaukee bucks": "Central",
  bucks: "Central",
  "minnesota timberwolves": "Northwest",
  timberwolves: "Northwest",
  wolves: "Northwest",
  "new orleans pelicans": "Southwest",
  pelicans: "Southwest",
  "new york knicks": "Atlantic",
  knicks: "Atlantic",
  "oklahoma city thunder": "Northwest",
  thunder: "Northwest",
  "orlando magic": "Southeast",
  magic: "Southeast",
  "philadelphia 76ers": "Atlantic",
  "76ers": "Atlantic",
  sixers: "Atlantic",
  "phoenix suns": "Pacific",
  suns: "Pacific",
  "portland trail blazers": "Northwest",
  "trail blazers": "Northwest",
  blazers: "Northwest",
  "sacramento kings": "Pacific",
  kings: "Pacific",
  "san antonio spurs": "Southwest",
  spurs: "Southwest",
  "toronto raptors": "Atlantic",
  raptors: "Atlantic",
  "utah jazz": "Northwest",
  jazz: "Northwest",
  "washington wizards": "Southeast",
  wizards: "Southeast",
};

export function resolveTeamDivision(teamName, storedDivision) {
  if (typeof teamName !== "string") {
    return typeof storedDivision === "string" && storedDivision.trim() ? storedDivision : "Unknown";
  }

  const normalizedName = getFullTeamName(teamName).trim().toLowerCase();
  return (
    TEAM_DIVISION_LABELS[normalizedName] ||
    TEAM_DIVISION_LABELS[teamName.trim().toLowerCase()] ||
    (typeof storedDivision === "string" && storedDivision.trim() ? storedDivision : "Unknown")
  );
}
