import { router } from 'expo-router';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { APPEARANCE_OPTIONS, useAppearance } from '@/src/lib/appearance';

/** E17: light, dark, or follow the phone. Stored on this device. */
export default function AppearanceScreen() {
  const { appearance, setAppearance } = useAppearance();
  return (
    <ChoiceList
      options={APPEARANCE_OPTIONS}
      value={appearance}
      onSelect={(v) => {
        void setAppearance(v);
        router.back();
      }}
      footer="Applies to this phone only."
    />
  );
}
