import { useAuth, useUser } from '@clerk/clerk-expo';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { useMe } from '@/src/features/settings/useMe';
import { TIMEZONES } from '@/src/lib/timezones';

/**
 * F1.4 + F1.6: profile preferences, sign out, delete account.
 */
export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const me = useMe();
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your expenses, plans, imports and attachments. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await me.deleteAccount();
              await signOut();
            } catch (err) {
              setDeleting(false);
              Alert.alert('Could not delete account', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  };

  if (me.loading && !me.profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Account</Text>
      <View style={styles.card}>
        <Row label="Email" value={user?.primaryEmailAddress?.emailAddress ?? me.profile?.email ?? '—'} />
      </View>

      <Text style={styles.section}>Preferences</Text>
      <View style={styles.card}>
        <OptionPicker
          label="Currency"
          value={me.profile?.defaultCurrency ?? 'XAF'}
          options={me.currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
          onChange={(code) => me.update({ defaultCurrency: code })}
          disabled={me.saving}
        />
        <View style={styles.separator} />
        <OptionPicker
          label="Timezone"
          value={me.profile?.timezone ?? 'Africa/Douala'}
          options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') }))}
          onChange={(tz) => me.update({ timezone: tz })}
          disabled={me.saving}
        />
      </View>
      {me.error ? <Text style={styles.error}>{me.error}</Text> : null}

      <Text style={styles.section}>Session</Text>
      <View style={styles.card}>
        <Pressable style={styles.action} onPress={() => signOut()}>
          <Text style={styles.actionText}>Sign out</Text>
        </Pressable>
        <View style={styles.separator} />
        <Pressable style={styles.action} onPress={confirmDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator />
          ) : (
            <Text style={[styles.actionText, styles.danger]}>Delete account</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 8, backgroundColor: '#F6F7F9', flexGrow: 1 },
  section: { fontSize: 12, textTransform: 'uppercase', color: '#777', marginTop: 12, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, gap: 12 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15, color: '#666', flexShrink: 1 },
  separator: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 14 },
  action: { padding: 14 },
  actionText: { fontSize: 15, color: '#1F5EFF' },
  danger: { color: '#C0392B' },
  error: { color: '#C0392B', fontSize: 13, marginLeft: 4 },
});
