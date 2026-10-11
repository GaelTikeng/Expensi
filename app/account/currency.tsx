import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChoiceList } from '@/src/features/account/ChoiceList';
import { useMe } from '@/src/features/settings/useMe';
import type { CurrencyCode } from '@/src/lib/currencies';

/** E17: default currency for new expenses and for recap totals. */
export default function CurrencyScreen() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <ChoiceList
      options={me.currencies.map((c) => ({ value: c.code as CurrencyCode, label: `${c.code} · ${c.symbol}`, description: t(`currency.names.${c.code}`) }))}
      value={me.profile?.defaultCurrency as CurrencyCode | undefined}
      onSelect={(code) => {
        void me.update({ defaultCurrency: code });
        router.back();
      }}
      footer={t('currency.footer')}
    />
  );
}
