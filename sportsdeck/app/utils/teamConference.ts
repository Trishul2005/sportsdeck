export const VALID_TEAM_CONFERENCES = ['Eastern Conference', 'Western Conference'] as const;

const TEAM_CONFERENCE_ALIASES: Record<string, (typeof VALID_TEAM_CONFERENCES)[number]> = {
	east: 'Eastern Conference',
	eastern: 'Eastern Conference',
	'eastern conference': 'Eastern Conference',
	west: 'Western Conference',
	western: 'Western Conference',
	'western conference': 'Western Conference',
};

export function normalizeTeamConference(conference: string | null | undefined) {
	if (typeof conference !== 'string') {
		return null;
	}

	return TEAM_CONFERENCE_ALIASES[conference.trim().toLowerCase()] || null;
}

export function isValidTeamConference(conference: string | null | undefined) {
	return normalizeTeamConference(conference) !== null;
}
