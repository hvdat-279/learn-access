module.exports = {
  preset: "jest-expo",
  testMatch: ["**/tests/**/*.test.[jt]s?(x)"],
  collectCoverageFrom: ["src/domain/**/*.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
};
