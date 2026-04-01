const FULL_TEAM_NAME_BY_NAME = {
  Hawks: "Atlanta Hawks",
  Celtics: "Boston Celtics",
  Nets: "Brooklyn Nets",
  Hornets: "Charlotte Hornets",
  Bulls: "Chicago Bulls",
  Cavaliers: "Cleveland Cavaliers",
  Cavs: "Cleveland Cavaliers",
  Mavericks: "Dallas Mavericks",
  Mavs: "Dallas Mavericks",
  Nuggets: "Denver Nuggets",
  Pistons: "Detroit Pistons",
  Warriors: "Golden State Warriors",
  Rockets: "Houston Rockets",
  Pacers: "Indiana Pacers",
  Clippers: "Los Angeles Clippers",
  Lakers: "Los Angeles Lakers",
  Grizzlies: "Memphis Grizzlies",
  Heat: "Miami Heat",
  Bucks: "Milwaukee Bucks",
  Timberwolves: "Minnesota Timberwolves",
  Wolves: "Minnesota Timberwolves",
  Pelicans: "New Orleans Pelicans",
  Knicks: "New York Knicks",
  Thunder: "Oklahoma City Thunder",
  Magic: "Orlando Magic",
  "76ers": "Philadelphia 76ers",
  Sixers: "Philadelphia 76ers",
  Suns: "Phoenix Suns",
  "Trail Blazers": "Portland Trail Blazers",
  Blazers: "Portland Trail Blazers",
  Kings: "Sacramento Kings",
  Spurs: "San Antonio Spurs",
  Raptors: "Toronto Raptors",
  Jazz: "Utah Jazz",
  Wizards: "Washington Wizards",
  "LA Clippers": "Los Angeles Clippers",
};

export function getFullTeamName(name) {
  if (!name) {
    return "Team TBD";
  }

  return FULL_TEAM_NAME_BY_NAME[name] || name;
}
