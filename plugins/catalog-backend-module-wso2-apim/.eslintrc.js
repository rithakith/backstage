module.exports = {
  ...require('@backstage/cli/config/eslint-factory')(__dirname),
  rules: {
    'notice/notice': 'off',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
