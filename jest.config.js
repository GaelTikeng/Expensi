/**
 * Four Jest projects (E12):
 * - unit:        pure logic in src/**, plain Node — `pnpm test`
 * - components:  screens and components with jest-expo + Testing Library — `pnpm test`
 * - integration: API route handlers against the Neon test branch (DATABASE_URL_TEST),
 *                Clerk / S3 / TensorX mocked — `pnpm test:integration`
 * - e2e:         the real API over HTTP against a running server — `pnpm test:e2e`
 *
 * Only the component project uses the jest-expo preset: its React Native
 * globals (fetch, XMLHttpRequest stubs) would break real HTTP clients in the
 * Node projects.
 */
const expoPreset = require('jest-expo/jest-preset');

// ESM packages that must be transformed rather than required as-is.
const TRANSFORM_IN_NODE_MODULES =
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-css-interop|nativewind|@rn-primitives/.*|lucide-react-native|@clerk/.*|@tanstack/.*|@expo/react-native-action-sheet|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-safe-area-context))';

const moduleNameMapper = { '^@/(.*)$': '<rootDir>/$1' };

const node = {
  testEnvironment: 'node',
  transform: { '^.+\\.(js|jsx|ts|tsx|mjs)$': 'babel-jest' },
  transformIgnorePatterns: [TRANSFORM_IN_NODE_MODULES],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  moduleNameMapper,
};

// jest-expo keys its JS transformer as '\\.[jt]sx?$'; reuse it for .mjs.
const expoJs = expoPreset.transform['\\.[jt]sx?$'];
if (!expoJs) throw new Error('jest-expo preset changed shape: no [jt]sx? transform found');
const native = {
  ...expoPreset,
  // Reanimated 4 under Jest: worklets resolve to their JS fallback instead of the native module.
  resolver: 'react-native-worklets/jest/resolver.js',
  transform: { ...expoPreset.transform, '^.+\\.mjs$': expoJs },
  transformIgnorePatterns: [TRANSFORM_IN_NODE_MODULES],
  moduleNameMapper: { ...(expoPreset.moduleNameMapper ?? {}), ...moduleNameMapper },
};

module.exports = {
  projects: [
    {
      ...node,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
    },
    {
      ...native,
      displayName: 'components',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/components.ts'],
    },
    {
      ...node,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setup/integration-env.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.ts'],
    },
    {
      ...node,
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setup/e2e-env.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.ts'],
    },
  ],
};
