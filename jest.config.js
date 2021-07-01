module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testRegex: '/test/.*\\.test\\.tsx$',
  modulePathIgnorePatterns: ['<rootDir>/examples/'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  moduleNameMapper: {
    '^swr$': '<rootDir>/src',
    '^swr/infinite': '<rootDir>/infinite',
    '^swr/immutable': '<rootDir>/immutable',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
}
