
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig: Config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
  ],
  testMatch: [
  "<rootDir>/tests/**/*.test.(ts|tsx)",
],
};

export default createJestConfig(customJestConfig);
