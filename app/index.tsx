import { useAuth, useUser } from '@clerk/clerk-expo';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder home. Replaced by the (auth) / (tabs) groups in E1 and E2.
 */
export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expense Tracker</Text>
      <Text style={styles.subtitle}>
        {!isLoaded ? 'Loading…' : isSignedIn ? `Signed in as ${user?.primaryEmailAddress?.emailAddress ?? user?.id}` : 'Not signed in'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
