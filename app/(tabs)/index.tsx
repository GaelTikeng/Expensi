import { useUser } from '@clerk/clerk-expo';
import { StyleSheet, Text, View } from 'react-native';

/** Placeholder home; the dashboard lands in F4.5. */
export default function HomeScreen() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'there';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello, {name}</Text>
      <Text style={styles.subtitle}>Your expenses will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { fontSize: 14, opacity: 0.7 },
});
