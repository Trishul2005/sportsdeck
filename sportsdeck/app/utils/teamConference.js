export const VALID_TEAM_CONFERENCES = ['Eastern Conference', 'Western Conference'];

const TEAM_CONFERENCE_ALIASES = {
	east: 'Eastern Conference',
	eastern: 'Eastern Conference',
	'eastern conference': 'Eastern Conference',
	west: 'Western Conference',
	western: 'Western Conference',
	'western conference': 'Western Conference',
};

export function normalizeTeamConference(conference) {
	if (typeof conference !== 'string') {
		return null;
	}

	return TEAM_CONFERENCE_ALIASES[conference.trim().toLowerCase()] || null;
}

export function isValidTeamConference(conference) {
	return normalizeTeamConference(conference) !== null;
}
