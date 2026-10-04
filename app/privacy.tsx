import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * F7.1: in-app privacy summary. The full policy lives in docs/PRIVACY_POLICY.md
 * and must be hosted at a public URL for the stores.
 */
const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What we store',
    body: 'Your email (via Clerk), the expenses, plans and fixed charges you enter, and any receipt photos, PDFs or spreadsheets you upload.',
  },
  {
    title: 'AI processing',
    body: 'When you import a file or open a weekly/monthly recap, the relevant data is sent to our AI processor, TensorX (EU-hosted, zero data retention), to extract line items or write a short summary. Nothing is added to your expenses without your confirmation.',
  },
  {
    title: 'Where',
    body: 'Database on Neon and files on Amazon S3, both in Frankfurt (eu-central-1). Files are private and only reachable through short-lived links created for you.',
  },
  {
    title: 'Reminders',
    body: 'Reminders are scheduled on this device. We do not read your notifications.',
  },
  {
    title: 'Your controls',
    body: 'Edit or delete anything at any time. Deleting your account in Settings removes all records and files immediately.',
  },
  {
    title: 'No ads, no tracking',
    body: 'We do not sell data, show ads, or use advertising identifiers.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>A plain-language summary. The full policy is published at the link in the app store listing.</Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.card}>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
      <Text style={styles.footer}>Contact: privacy@nyota.ltd</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontSize: 13, color: '#666' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20, color: '#333' },
  footer: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
});
