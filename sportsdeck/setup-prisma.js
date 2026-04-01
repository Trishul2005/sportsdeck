#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

const isWsl =
	Boolean(process.env.WSL_DISTRO_NAME) ||
	Boolean(process.env.WSL_INTEROP) ||
	/microsoft/i.test(os.release());
const shouldDisableErd = process.platform === 'linux' || isWsl;

if (shouldDisableErd) {
	schema = schema.replace(
		/generator erd \{[\s\S]*?\}/,
		`// generator erd {\n  // provider = "prisma-erd-generator"\n  // theme = "dark"\n// }`,
	);
	console.log('ERD generator disabled for Linux/WSL');
} else {
	schema = schema.replace(
		/\/\/ generator erd \{[\s\S]*?\/\/ \}/,
		`generator erd {\n  provider = "prisma-erd-generator"\n  theme = "dark"\n}`,
	);
	console.log('ERD generator enabled');
}

fs.writeFileSync(schemaPath, schema, 'utf-8');
