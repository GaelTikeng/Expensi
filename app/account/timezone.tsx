import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { useMe } from '@/src/features/settings/useMe';
import { TIMEZONES } from '@/src/lib/timezones';

/** E17: the zone planned expenses, reminders and "today" are computed in. */
export default function TimezoneScreen() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <ChoiceList
      options={TIMEZONES.map((tz) => {
        const [region, ...rest] = tz.split('/');
        return { value: tz, label: rest.join(' / ').replace(/_/g, ' '), description: region };
      })}
      value={me.profile?.timezone}
      onSelect={(tz) => {
        void me.update({ timezone: tz });
        router.back();
      }}
      footer={t('timezone.footer')}
    />
  );
}
