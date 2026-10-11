import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { useMe } from '@/src/features/settings/useMe';
import { LANGUAGE_NAMES, LANGUAGES, type LanguagePref } from '@/src/i18n';
import { applyLanguage, deviceLanguage, useLanguagePref } from '@/src/i18n/language';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/src/lib/query';

/**
 * E14: the app's language. Applies at once on this phone and is saved to the
 * account (users.language), so other devices and the server follow it.
 */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const pref = useLanguagePref();
  const qc = useQueryClient();
  return (
    <ChoiceList<LanguagePref>
      options={[
        { value: 'system', label: t('language.system'), description: LANGUAGE_NAMES[deviceLanguage()] },
        ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] })),
      ]}
      value={pref}
      onSelect={(next) => {
        void applyLanguage(next);
        // The server drops summaries written in the old language; refetch so they go.
        void me.update({ language: next === 'system' ? null : next }).then(() => qc.invalidateQueries({ queryKey: keys.recaps.all }));
        router.back();
      }}
      footer={t('language.footer')}
    />
  );
}
