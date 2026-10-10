import { ScrollView } from 'react-native';

import { Card, CardTitle } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';

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
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
      <Text className="text-muted-foreground text-[13px]">A plain-language summary. The full policy is published at the link in the app store listing.</Text>
      {SECTIONS.map((s) => (
        <Card key={s.title} className="gap-1.5 p-3.5">
          <CardTitle className="text-[15px]">{s.title}</CardTitle>
          <Text className="text-sm leading-5">{s.body}</Text>
        </Card>
      ))}
      <Text className="text-muted-foreground mt-2 text-center text-xs">Contact: privacy@nyota.ltd</Text>
    </ScrollView>
  );
}
