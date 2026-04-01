export default {
	testEnvironment: 'node',
	roots: ['<rootDir>/tests'],
	testTimeout: 10000,
	transform: {
		'^.+\\.js$': 'babel-jest',
	},
	setupFilesAfterEnv: ['<rootDir>/tests/helpers/jest.setup.js'],
	moduleNameMapper: {
		'^@/prisma/(.*)$': '<rootDir>/prisma/$1',
		'^@/(.*)$': '<rootDir>/$1',
	},
	modulePathIgnorePatterns: ['<rootDir>/.vscode', '<rootDir>/.cursor'],
};
