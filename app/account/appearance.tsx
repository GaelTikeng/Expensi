import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { APPEARANCE_VALUES, useAppearance } from '@/src/lib/appearance';

/** E17: light, dark, or follow the phone. Stored on this device. */
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { appearance, setAppearance } = useAppearance();
  return (
    <ChoiceList
      options={APPEARANCE_VALUES.map((v) => ({ value: v, label: t(`appearance.${v}`) }))}
      value={appearance}
      onSelect={(v) => {
        void setAppearance(v);
        router.back();
      }}
      footer={t('appearance.footer')}
    />
  );
}
