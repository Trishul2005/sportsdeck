const TEAM_VENUES: Record<string, string> = {
	'atlanta hawks': 'State Farm Arena',
	hawks: 'State Farm Arena',
	'boston celtics': 'TD Garden',
	celtics: 'TD Garden',
	'brooklyn nets': 'Barclays Center',
	nets: 'Barclays Center',
	'charlotte hornets': 'Spectrum Center',
	hornets: 'Spectrum Center',
	'chicago bulls': 'United Center',
	bulls: 'United Center',
	'cleveland cavaliers': 'Rocket Mortgage FieldHouse',
	cavaliers: 'Rocket Mortgage FieldHouse',
	cavs: 'Rocket Mortgage FieldHouse',
	'dallas mavericks': 'American Airlines Center',
	mavericks: 'American Airlines Center',
	mavs: 'American Airlines Center',
	'denver nuggets': 'Ball Arena',
	nuggets: 'Ball Arena',
	'detroit pistons': 'Little Caesars Arena',
	pistons: 'Little Caesars Arena',
	'golden state warriors': 'Chase Center',
	warriors: 'Chase Center',
	'houston rockets': 'Toyota Center',
	rockets: 'Toyota Center',
	'indiana pacers': 'Gainbridge Fieldhouse',
	pacers: 'Gainbridge Fieldhouse',
	'la clippers': 'Intuit Dome',
	'los angeles clippers': 'Intuit Dome',
	clippers: 'Intuit Dome',
	'la lakers': 'Crypto.com Arena',
	'los angeles lakers': 'Crypto.com Arena',
	lakers: 'Crypto.com Arena',
	'memphis grizzlies': 'FedExForum',
	grizzlies: 'FedExForum',
	'miami heat': 'Kaseya Center',
	heat: 'Kaseya Center',
	'milwaukee bucks': 'Fiserv Forum',
	bucks: 'Fiserv Forum',
	'minnesota timberwolves': 'Target Center',
	timberwolves: 'Target Center',
	wolves: 'Target Center',
	'new orleans pelicans': 'Smoothie King Center',
	pelicans: 'Smoothie King Center',
	'new york knicks': 'Madison Square Garden',
	knicks: 'Madison Square Garden',
	'oklahoma city thunder': 'Paycom Center',
	thunder: 'Paycom Center',
	'orlando magic': 'Kia Center',
	magic: 'Kia Center',
	'philadelphia 76ers': 'Wells Fargo Center',
	'76ers': 'Wells Fargo Center',
	sixers: 'Wells Fargo Center',
	'phoenix suns': 'Footprint Center',
	suns: 'Footprint Center',
	'portland trail blazers': 'Moda Center',
	'trail blazers': 'Moda Center',
	blazers: 'Moda Center',
	'sacramento kings': 'Golden 1 Center',
	kings: 'Golden 1 Center',
	'san antonio spurs': 'Frost Bank Center',
	spurs: 'Frost Bank Center',
	'toronto raptors': 'Scotiabank Arena',
	raptors: 'Scotiabank Arena',
	'utah jazz': 'Delta Center',
	jazz: 'Delta Center',
	'washington wizards': 'Capital One Arena',
	wizards: 'Capital One Arena',
};

const TEAM_HOME_CITIES: Record<string, string> = {
	'atlanta hawks': 'Atlanta, GA',
	hawks: 'Atlanta, GA',
	'boston celtics': 'Boston, MA',
	celtics: 'Boston, MA',
	'brooklyn nets': 'Brooklyn, NY',
	nets: 'Brooklyn, NY',
	'charlotte hornets': 'Charlotte, NC',
	hornets: 'Charlotte, NC',
	'chicago bulls': 'Chicago, IL',
	bulls: 'Chicago, IL',
	'cleveland cavaliers': 'Cleveland, OH',
	cavaliers: 'Cleveland, OH',
	cavs: 'Cleveland, OH',
	'dallas mavericks': 'Dallas, TX',
	mavericks: 'Dallas, TX',
	mavs: 'Dallas, TX',
	'denver nuggets': 'Denver, CO',
	nuggets: 'Denver, CO',
	'detroit pistons': 'Detroit, MI',
	pistons: 'Detroit, MI',
	'golden state warriors': 'San Francisco, CA',
	warriors: 'San Francisco, CA',
	'houston rockets': 'Houston, TX',
	rockets: 'Houston, TX',
	'indiana pacers': 'Indianapolis, IN',
	pacers: 'Indianapolis, IN',
	'la clippers': 'Los Angeles, CA',
	'los angeles clippers': 'Los Angeles, CA',
	clippers: 'Los Angeles, CA',
	'la lakers': 'Los Angeles, CA',
	'los angeles lakers': 'Los Angeles, CA',
	lakers: 'Los Angeles, CA',
	'memphis grizzlies': 'Memphis, TN',
	grizzlies: 'Memphis, TN',
	'miami heat': 'Miami, FL',
	heat: 'Miami, FL',
	'milwaukee bucks': 'Milwaukee, WI',
	bucks: 'Milwaukee, WI',
	'minnesota timberwolves': 'Minneapolis, MN',
	timberwolves: 'Minneapolis, MN',
	wolves: 'Minneapolis, MN',
	'new orleans pelicans': 'New Orleans, LA',
	pelicans: 'New Orleans, LA',
	'new york knicks': 'New York, NY',
	knicks: 'New York, NY',
	'oklahoma city thunder': 'Oklahoma City, OK',
	thunder: 'Oklahoma City, OK',
	'orlando magic': 'Orlando, FL',
	magic: 'Orlando, FL',
	'philadelphia 76ers': 'Philadelphia, PA',
	'76ers': 'Philadelphia, PA',
	sixers: 'Philadelphia, PA',
	'phoenix suns': 'Phoenix, AZ',
	suns: 'Phoenix, AZ',
	'portland trail blazers': 'Portland, OR',
	'trail blazers': 'Portland, OR',
	blazers: 'Portland, OR',
	'sacramento kings': 'Sacramento, CA',
	kings: 'Sacramento, CA',
	'san antonio spurs': 'San Antonio, TX',
	spurs: 'San Antonio, TX',
	'toronto raptors': 'Toronto, ON',
	raptors: 'Toronto, ON',
	'utah jazz': 'Salt Lake City, UT',
	jazz: 'Salt Lake City, UT',
	'washington wizards': 'Washington, DC',
	wizards: 'Washington, DC',
};

function normalizeTeamKey(teamName: string) {
	return teamName.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getTeamVenue(teamName: string | null | undefined) {
	if (!teamName) {
		return null;
	}

	return TEAM_VENUES[normalizeTeamKey(teamName)] || null;
}

export function getTeamCity(teamName: string | null | undefined) {
	if (!teamName) {
		return null;
	}

	return TEAM_HOME_CITIES[normalizeTeamKey(teamName)] || null;
}

export function formatVenueWithArena(location: string | null | undefined, homeTeamName: string | null | undefined) {
	const arena = getTeamVenue(homeTeamName);
	const city = getTeamCity(homeTeamName);
	const trimmedLocation = location?.trim();

	if (trimmedLocation && arena) {
		if (city && trimmedLocation === city) {
			return arena;
		}

		return trimmedLocation.includes(arena) ? trimmedLocation : `${trimmedLocation} | ${arena}`;
	}

	return trimmedLocation || arena || null;
}
