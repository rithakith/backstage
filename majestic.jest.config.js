module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      require.resolve('@backstage/cli/config/jestSwcTransform.js'),
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/'],
  testMatch: [
    '<rootDir>/plugins/catalog-backend-module-asgardeo/**/*.test.ts',
    '<rootDir>/plugins/catalog-backend-module-asgardeo/**/*.test.tsx',
    '<rootDir>/plugins/catalog-backend-module-wso2-apim/**/*.test.ts',
    '<rootDir>/plugins/catalog-backend-module-wso2-apim/**/*.test.tsx',
    '<rootDir>/plugins/wso2-api-manager/**/*.test.ts',
    '<rootDir>/plugins/wso2-api-manager/**/*.test.tsx',
    '<rootDir>/plugins/wso2-api-manager-backend/**/*.test.ts',
    '<rootDir>/plugins/wso2-api-manager-backend/**/*.test.tsx'
  ],
  roots: [
    '<rootDir>/plugins/catalog-backend-module-asgardeo',
    '<rootDir>/plugins/catalog-backend-module-wso2-apim',
    '<rootDir>/plugins/wso2-api-manager',
    '<rootDir>/plugins/wso2-api-manager-backend'
  ]
};
