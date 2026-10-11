import { ScrollView } from 'react-native';

import { Card, CardTitle } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { useTranslation } from 'react-i18next';

/**
 * F7.1: in-app privacy summary. The full policy lives in docs/PRIVACY_POLICY.md
 * and must be hosted at a public URL for the stores.
 */
const SECTIONS = ['stored', 'ai', 'where', 'reminders', 'controls', 'noAds'] as const;
const CONTACT = 'privacy@nyota.ltd';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
      <Text className="text-muted-foreground text-[13px]">{t('privacy.intro')}</Text>
      {SECTIONS.map((s) => (
        <Card key={s} className="gap-1.5 p-3.5">
          <CardTitle className="text-[15px]">{t(`privacy.sections.${s}.title`)}</CardTitle>
          <Text className="text-sm leading-5">{t(`privacy.sections.${s}.body`)}</Text>
        </Card>
      ))}
      <Text className="text-muted-foreground mt-2 text-center text-xs">{t('privacy.contact', { email: CONTACT })}</Text>
    </ScrollView>
  );
}
