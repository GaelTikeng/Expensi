// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', '.expo/*', 'src/server/db/migrations/*'],
  },
  {
    // Client code must never import server code (CLAUDE.md §7). API routes
    // and the server tree itself are exempt.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['app/api/**', 'src/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', '@/src/server/**', '@/src/server'],
              message: 'Client code must not import from src/server. Call an API route instead.',
            },
          ],
        },
      ],
    },
  },
]);
