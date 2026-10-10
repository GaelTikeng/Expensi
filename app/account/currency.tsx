import { router } from 'expo-router';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { useMe } from '@/src/features/settings/useMe';
import type { CurrencyCode } from '@/src/lib/currencies';

/** E17: default currency for new expenses and for recap totals. */
export default function CurrencyScreen() {
  const me = useMe();
  return (
    <ChoiceList
      options={me.currencies.map((c) => ({ value: c.code as CurrencyCode, label: `${c.code} · ${c.symbol}`, description: c.name }))}
      value={me.profile?.defaultCurrency as CurrencyCode | undefined}
      onSelect={(code) => {
        void me.update({ defaultCurrency: code });
        router.back();
      }}
      footer="New expenses start in this currency, and recaps and the home screen add up totals in it."
    />
  );
}
