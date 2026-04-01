// Test script to check NBA API directly
require('dotenv').config();

async function testNBAApi() {
	const baseUrl = process.env.NBA_API_BASE_URL;
	const apiKey = process.env.NBA_API_KEY;
	const apiHost = process.env.NBA_API_HOST;

	console.log('Testing NBA API...');
	console.log('Base URL:', baseUrl);
	console.log('API Host:', apiHost);
	console.log(
		'API Key:',
		apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET',
	);

	// Test 1: Try to fetch scoreboard
	const url = `${baseUrl}/nbascoreboard?year=2024&month=03&day=01`;

	console.log('\nFetching:', url);

	try {
		const response = await fetch(url, {
			headers: {
				'x-rapidapi-key': apiKey,
				'x-rapidapi-host': apiHost,
			},
		});

		console.log('Response status:', response.status);
		console.log(
			'Response headers:',
			Object.fromEntries(response.headers.entries()),
		);

		const text = await response.text();
		console.log('Response body (first 500 chars):', text.substring(0, 500));

		if (response.ok) {
			try {
				const data = JSON.parse(text);
				console.log('\nParsed JSON keys:', Object.keys(data));
				if (data.games) console.log('Games count:', data.games.length);
				if (data.response) console.log('Response data:', data.response);
			} catch (e) {
				console.log('Could not parse as JSON');
			}
		} else {
			console.log('\nAPI returned error status:', response.status);
		}
	} catch (error) {
		console.error('Fetch error:', error.message);
	}
}

testNBAApi().catch(console.error);
