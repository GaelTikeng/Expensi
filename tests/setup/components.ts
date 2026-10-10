/**
 * Component project setup: native modules that have no meaning under Jest are
 * replaced with their official mocks, and the app's external services are
 * stubbed so a screen can render without a session or a network.
 */
require('react-native-gesture-handler/jestSetup');

// Reanimated 4's own test setup (with the worklets resolver in jest.config.js).
require('react-native-reanimated').setUpTests();

jest.mock('@clerk/expo', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: 'user_test', getToken: async () => 'test-token', signOut: jest.fn() }),
  useUser: () => ({ user: { firstName: 'Test', primaryEmailAddress: { emailAddress: 'test@example.com' } } }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    Stack: Object.assign(() => null, { Screen: () => null }),
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@expo/react-native-action-sheet', () => ({
  ActionSheetProvider: ({ children }: { children: React.ReactNode }) => children,
  useActionSheet: () => ({ showActionSheetWithOptions: jest.fn() }),
}));
