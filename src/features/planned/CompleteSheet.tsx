import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { LocalFilesPicker } from '@/src/features/attachments/LocalFilesPicker';
import type { LocalFile } from '@/src/features/attachments/pick';
import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { useThemeColors } from '@/src/lib/theme';

export interface CompleteValues {
  amountMinor: number;
  occurredOn: string;
  files: LocalFile[];
}

/** F5.6 + F2b.8: confirm what was actually paid, when, with an optional receipt. */
export function CompleteSheet({
  plan,
  currency,
  busy,
  onConfirm,
  onClose,
}: {
  plan: PlannedDto | null;
  currency: CurrencyInfo;
  busy: boolean;
  onConfirm: (values: CompleteValues) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={plan !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/35">
        {plan ? <Body key={plan.id} plan={plan} currency={currency} busy={busy} onConfirm={onConfirm} onClose={onClose} /> : null}
      </View>
    </Modal>
  );
}

function Body({ plan, currency, busy, onConfirm, onClose }: { plan: PlannedDto; currency: CurrencyInfo; busy: boolean; onConfirm: (v: CompleteValues) => void; onClose: () => void }) {
  const theme = useThemeColors();
  const [amountMinor, setAmountMinor] = useState<number | null>(plan.amountMinor);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [files, setFiles] = useState<LocalFile[]>([]);

  return (
    <View className="bg-background max-h-[90%] gap-2 rounded-t-2xl p-4 pb-8">
      <View className="bg-input mb-1 h-1 w-10 self-center rounded-full" />
      <Text variant="large">Mark as paid</Text>
      <Text variant="muted">{plan.title}</Text>
      <ScrollView contentContainerClassName="gap-3 py-2" keyboardShouldPersistTaps="handled">
        <Text className="text-[15px]">Amount actually paid</Text>
        <AmountInput value={amountMinor} currency={currency} onChange={setAmountMinor} />
        <View className="bg-card border-border rounded-lg border px-4 py-3">
          <DateField label="Paid on" value={occurredOn} onChange={(d) => d && setOccurredOn(d)} />
        </View>
        <LocalFilesPicker files={files} onChange={setFiles} />
      </ScrollView>
      <View className="mt-2 flex-row gap-3">
        <Button variant="outline" size="lg" className="flex-1" onPress={onClose} disabled={busy}>
          <Text>Cancel</Text>
        </Button>
        <Button
          size="lg"
          className="bg-success active:bg-success/90 flex-1"
          disabled={busy || !amountMinor}
          onPress={() => amountMinor && onConfirm({ amountMinor, occurredOn, files })}
        >
          {busy ? <ActivityIndicator color={theme.primaryForeground} /> : <Text className="text-success-foreground">Confirm</Text>}
        </Button>
      </View>
    </View>
  );
}
