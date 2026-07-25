/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  // deploy.test.ts requires Docker + soroban-cli; run via `npm run test:integration` instead.
  testPathIgnorePatterns: ['/node_modules/', 'tests/integration/deploy\\.test\\.ts'],
};
