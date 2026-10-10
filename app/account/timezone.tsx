import { router } from 'expo-router';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { useMe } from '@/src/features/settings/useMe';
import { TIMEZONES } from '@/src/lib/timezones';

/** E17: the zone planned expenses, reminders and "today" are computed in. */
export default function TimezoneScreen() {
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
      footer="Used for planned expenses, reminders and what counts as today."
    />
  );
}
