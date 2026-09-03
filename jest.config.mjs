/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          verbatimModuleSyntax: false,
          esModuleInterop: true,
        },
      },
    ],
  },
  clearMocks: true,
  collectCoverageFrom: ["src/modules/**/*.ts", "src/core/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: { branches: 55, functions: 60, lines: 60, statements: 60 },
  },
};

export default config;
