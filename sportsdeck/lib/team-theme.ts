export const DEFAULT_THEME_COLOR = "#ff7a2f";

const TEAM_THEME_COLORS: Record<string, string> = {
  "Atlanta Hawks": "#C8102E",
  Hawks: "#C8102E",
  "Boston Celtics": "#007A33",
  Celtics: "#007A33",
  "Brooklyn Nets": "#111111",
  Nets: "#111111",
  "Charlotte Hornets": "#1D1160",
  Hornets: "#1D1160",
  "Chicago Bulls": "#CE1141",
  Bulls: "#CE1141",
  "Cleveland Cavaliers": "#6F263D",
  Cavaliers: "#6F263D",
  Cavs: "#6F263D",
  "Dallas Mavericks": "#00538C",
  Mavericks: "#00538C",
  Mavs: "#00538C",
  "Denver Nuggets": "#0E2240",
  Nuggets: "#0E2240",
  "Detroit Pistons": "#1D42BA",
  Pistons: "#1D42BA",
  "Golden State Warriors": "#1D428A",
  Warriors: "#1D428A",
  "Houston Rockets": "#CE1141",
  Rockets: "#CE1141",
  "Indiana Pacers": "#002D62",
  Pacers: "#002D62",
  "LA Clippers": "#C8102E",
  "Los Angeles Clippers": "#C8102E",
  Clippers: "#C8102E",
  "Los Angeles Lakers": "#552583",
  Lakers: "#552583",
  "Memphis Grizzlies": "#5D76A9",
  Grizzlies: "#5D76A9",
  "Miami Heat": "#98002E",
  Heat: "#98002E",
  "Milwaukee Bucks": "#00471B",
  Bucks: "#00471B",
  "Minnesota Timberwolves": "#0C2340",
  Timberwolves: "#0C2340",
  Wolves: "#0C2340",
  "New Orleans Pelicans": "#0C2340",
  Pelicans: "#0C2340",
  "New York Knicks": "#F58426",
  Knicks: "#F58426",
  "Oklahoma City Thunder": "#007AC1",
  Thunder: "#007AC1",
  "Orlando Magic": "#0077C0",
  Magic: "#0077C0",
  "Philadelphia 76ers": "#006BB6",
  Sixers: "#006BB6",
  "Phoenix Suns": "#1D1160",
  Suns: "#1D1160",
  "Portland Trail Blazers": "#E03A3E",
  "Trail Blazers": "#E03A3E",
  Blazers: "#E03A3E",
  "Sacramento Kings": "#5A2D81",
  Kings: "#5A2D81",
  "San Antonio Spurs": "#C4CED4",
  Spurs: "#C4CED4",
  "Toronto Raptors": "#CE1141",
  Raptors: "#CE1141",
  "Utah Jazz": "#F9A01B",
  Jazz: "#F9A01B",
  "Washington Wizards": "#002B5C",
  Wizards: "#002B5C",
};

function normalizeTeamThemeKey(teamName: string) {
  return teamName.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function getTeamThemeColor(teamName: string | null | undefined) {
  if (!teamName) {
    return DEFAULT_THEME_COLOR;
  }

  const exactMatch = TEAM_THEME_COLORS[teamName];
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedName = normalizeTeamThemeKey(teamName);
  const matchedEntry = Object.entries(TEAM_THEME_COLORS).find(
    ([key]) => normalizeTeamThemeKey(key) === normalizedName,
  );
  if (matchedEntry) {
    return matchedEntry[1];
  }

  const partialMatch = Object.entries(TEAM_THEME_COLORS).find(([key]) => {
    const normalizedKey = normalizeTeamThemeKey(key);
    return normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName);
  });

  return partialMatch?.[1] || DEFAULT_THEME_COLOR;
}

export function withAlpha(hexColor: string, alpha: number) {
  const sanitized = hexColor.replace("#", "");
  const normalized =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : sanitized;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
