export type MatchStatus = 'live' | 'upcoming' | 'completed';

export type MatchTeam = {
	code: string;
	name: string;
	side: 'Home' | 'Away';
	score?: number;
	color: string;
};

export type Match = {
	id: string;
	status: MatchStatus;
	periodLabel: string;
	matchday: string;
	venue: string;
	home: MatchTeam;
	away: MatchTeam;
};

export type Thread = {
	id: string;
	code: string;
	title: string;
	author: string;
	date: string;
	count: number;
	isClosed?: boolean;
};

export type Team = {
	id: string;
	shortName: string;
	name: string;
	primaryColor: string;
	logoUrl: string;
};

export const currentUser = {
	username: 'hoopsfanatic',
	email: 'hoopsfanatic@sportsdeck.app',
	avatar: '',
};

export const matches: Match[] = [
	{
		id: 'lal-bos-live',
		status: 'live',
		periodLabel: 'LIVE - Q4 2:34',
		matchday: 'Matchday 65',
		venue: 'Crypto.com Arena',
		home: {
			code: 'LAL',
			name: 'Los Angeles Lakers',
			side: 'Home',
			score: 112,
			color: 'bg-violet-700',
		},
		away: {
			code: 'BOS',
			name: 'Boston Celtics',
			side: 'Away',
			score: 108,
			color: 'bg-emerald-600',
		},
	},
	{
		id: 'gsw-mia-live',
		status: 'live',
		periodLabel: 'LIVE - Q3 8:12',
		matchday: 'Matchday 65',
		venue: 'Chase Center',
		home: {
			code: 'GSW',
			name: 'Golden State Warriors',
			side: 'Home',
			score: 98,
			color: 'bg-blue-700',
		},
		away: {
			code: 'MIA',
			name: 'Miami Heat',
			side: 'Away',
			score: 95,
			color: 'bg-rose-700',
		},
	},
	{
		id: 'bkn-phx-upcoming',
		status: 'upcoming',
		periodLabel: '6:00 PM',
		matchday: 'Tonight',
		venue: 'Footprint Center',
		home: {
			code: 'BKN',
			name: 'Brooklyn Nets',
			side: 'Home',
			color: 'bg-slate-700',
		},
		away: {
			code: 'PHX',
			name: 'Phoenix Suns',
			side: 'Away',
			color: 'bg-orange-600',
		},
	},
	{
		id: 'mil-dal-upcoming',
		status: 'upcoming',
		periodLabel: '4:00 PM',
		matchday: 'Tonight',
		venue: 'American Airlines Center',
		home: {
			code: 'MIL',
			name: 'Milwaukee Bucks',
			side: 'Home',
			color: 'bg-emerald-700',
		},
		away: {
			code: 'DAL',
			name: 'Dallas Mavericks',
			side: 'Away',
			color: 'bg-sky-700',
		},
	},
];

export const threads: Thread[] = [
	{
		id: 'thread-1',
		code: 'HO',
		title: 'Lakers vs Celtics tonight - Championship preview?',
		author: 'hoopsfanatic',
		date: 'Yesterday',
		count: 156,
	},
	{
		id: 'thread-2',
		code: 'DU',
		title: 'Curry still the best shooter ever?',
		author: 'dub_nation',
		date: 'Yesterday',
		count: 234,
	},
	{
		id: 'thread-3',
		code: 'NB',
		title: 'Trade deadline analysis - Winners and Losers',
		author: 'nba_analyst',
		date: 'Mar 20',
		count: 89,
	},
];

export const aiDigest = {
	matchesSummary:
		'Two exciting games are live right now! Lakers lead Celtics 112-108 in a potential Finals preview, while Warriors edge Heat 98-95. Yesterday, Nuggets dominated inside and the MVP race tightened again.',
	trendingTopics: ['Lakers vs Celtics', 'MVP Race', 'Curry 3-pointers'],
};

export const teams: Team[] = [
	{ id: 'lal', shortName: 'LAL', name: 'Los Angeles Lakers', primaryColor: '#7c3aed', logoUrl: 'https://highlightly.net/nba/images/teams/4.png' },
	{ id: 'bos', shortName: 'BOS', name: 'Boston Celtics', primaryColor: '#059669', logoUrl: 'https://highlightly.net/nba/images/teams/2.png' },
	{ id: 'gsw', shortName: 'GSW', name: 'Golden State Warriors', primaryColor: '#2563eb', logoUrl: 'https://highlightly.net/nba/images/teams/43.png' },
	{ id: 'mia', shortName: 'MIA', name: 'Miami Heat', primaryColor: '#be123c', logoUrl: 'https://highlightly.net/nba/images/teams/1.png' },
	{ id: 'bkn', shortName: 'BKN', name: 'Brooklyn Nets', primaryColor: '#475569', logoUrl: 'https://highlightly.net/nba/images/teams/49.png' },
	{ id: 'phx', shortName: 'PHX', name: 'Phoenix Suns', primaryColor: '#ea580c', logoUrl: 'https://highlightly.net/nba/images/teams/46.png' },
	{ id: 'mil', shortName: 'MIL', name: 'Milwaukee Bucks', primaryColor: '#047857', logoUrl: 'https://highlightly.net/nba/images/teams/39.png' },
	{ id: 'dal', shortName: 'DAL', name: 'Dallas Mavericks', primaryColor: '#0284c7', logoUrl: 'https://highlightly.net/nba/images/teams/40.png' },
	{ id: 'den', shortName: 'DEN', name: 'Denver Nuggets', primaryColor: '#1d4ed8', logoUrl: 'https://highlightly.net/nba/images/teams/3.png' },
	{ id: 'phi', shortName: 'PHI', name: 'Philadelphia 76ers', primaryColor: '#dc2626', logoUrl: 'https://highlightly.net/nba/images/teams/71.png' },
	{ id: 'atl', shortName: 'ATL', name: 'Atlanta Hawks', primaryColor: '#ef4444', logoUrl: 'https://highlightly.net/nba/images/teams/23.png' },
	{ id: 'cha', shortName: 'CHA', name: 'Charlotte Hornets', primaryColor: '#0ea5e9', logoUrl: 'https://highlightly.net/nba/images/teams/33.png' },
	{ id: 'chi', shortName: 'CHI', name: 'Chicago Bulls', primaryColor: '#b91c1c', logoUrl: 'https://highlightly.net/nba/images/teams/27.png' },
	{ id: 'cle', shortName: 'CLE', name: 'Cleveland Cavaliers', primaryColor: '#7c2d12', logoUrl: 'https://highlightly.net/nba/images/teams/35.png' },
	{ id: 'det', shortName: 'DET', name: 'Detroit Pistons', primaryColor: '#1d4ed8', logoUrl: 'https://highlightly.net/nba/images/teams/25.png' },
	{ id: 'ind', shortName: 'IND', name: 'Indiana Pacers', primaryColor: '#1e3a8a', logoUrl: 'https://highlightly.net/nba/images/teams/36.png' },
	{ id: 'nyk', shortName: 'NYK', name: 'New York Knicks', primaryColor: '#ea580c', logoUrl: 'https://highlightly.net/nba/images/teams/26.png' },
	{ id: 'orl', shortName: 'ORL', name: 'Orlando Magic', primaryColor: '#2563eb', logoUrl: 'https://highlightly.net/nba/images/teams/24.png' },
	{ id: 'tor', shortName: 'TOR', name: 'Toronto Raptors', primaryColor: '#dc2626', logoUrl: 'https://highlightly.net/nba/images/teams/34.png' },
	{ id: 'was', shortName: 'WAS', name: 'Washington Wizards', primaryColor: '#2563eb', logoUrl: 'https://highlightly.net/nba/images/teams/50.png' },
	{ id: 'mem', shortName: 'MEM', name: 'Memphis Grizzlies', primaryColor: '#0f766e', logoUrl: 'https://highlightly.net/nba/images/teams/42.png' },
	{ id: 'nop', shortName: 'NOP', name: 'New Orleans Pelicans', primaryColor: '#0f172a', logoUrl: 'https://highlightly.net/nba/images/teams/64.png' },
	{ id: 'sas', shortName: 'SAS', name: 'San Antonio Spurs', primaryColor: '#94a3b8', logoUrl: 'https://highlightly.net/nba/images/teams/37.png' },
	{ id: 'hou', shortName: 'HOU', name: 'Houston Rockets', primaryColor: '#dc2626', logoUrl: 'https://highlightly.net/nba/images/teams/28.png' },
	{ id: 'uta', shortName: 'UTA', name: 'Utah Jazz', primaryColor: '#ca8a04', logoUrl: 'https://highlightly.net/nba/images/teams/45.png' },
	{ id: 'okc', shortName: 'OKC', name: 'Oklahoma City Thunder', primaryColor: '#2563eb', logoUrl: 'https://highlightly.net/nba/images/teams/38.png' },
	{ id: 'min', shortName: 'MIN', name: 'Minnesota Timberwolves', primaryColor: '#0ea5e9', logoUrl: 'https://highlightly.net/nba/images/teams/41.png' },
	{ id: 'por', shortName: 'POR', name: 'Portland Trail Blazers', primaryColor: '#b91c1c', logoUrl: 'https://highlightly.net/nba/images/teams/31.png' },
	{ id: 'sac', shortName: 'SAC', name: 'Sacramento Kings', primaryColor: '#7c3aed', logoUrl: 'https://highlightly.net/nba/images/teams/32.png' },
	{ id: 'lac', shortName: 'LAC', name: 'LA Clippers', primaryColor: '#dc2626', logoUrl: 'https://highlightly.net/nba/images/teams/30.png' },
];
