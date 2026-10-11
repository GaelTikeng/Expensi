import { router } from 'expo-router';
import { ArrowRight, Copy } from 'lucide-react-native';
import { Fragment } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { formatDDMMYYYY } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { DuplicateCandidate, ImportItemDto } from '@/src/lib/schemas/import';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';
import { useTranslation } from 'react-i18next';

export interface DuplicatePair {
  item: ImportItemDto;
  existing: DuplicateCandidate;
}

/**
 * F3.14: side-by-side comparison of a staged line and the ledger expense it
 * looks like, with the ways to end up with one record.
 * - Before commit: skip the line, import it anyway, or replace the existing
 *   expense with it.
 * - After commit (the line is already an expense): keep one, delete the other.
 */
export function DuplicateSheet({
  pair,
  currency,
  categoryName,
  committed,
  busy,
  onSkip,
  onKeepBoth,
  onDeleteExisting,
  onDeleteThis,
  onClose,
}: {
  pair: DuplicatePair | null;
  currency: CurrencyInfo;
  categoryName: (id: string | null) => string | undefined;
  /** The import is committed: this line already exists as an expense. */
  committed: boolean;
  busy: boolean;
  onSkip: () => void;
  onKeepBoth: () => void;
  onDeleteExisting: () => void;
  onDeleteThis: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useThemeColors();
  if (!pair) return <Modal visible={false} />;
  const { item, existing } = pair;

  const rows: { label: string; mine: string; theirs: string }[] = [
    { label: t('imports.duplicate.fields.description'), mine: item.description ?? item.rawText, theirs: existing.description },
    { label: t('imports.duplicate.fields.amount'), mine: item.amountMinor != null ? formatMoney(item.amountMinor, currency) : '—', theirs: formatMoney(existing.amountMinor, currency) },
    { label: t('imports.duplicate.fields.date'), mine: item.occurredOn ? formatDDMMYYYY(item.occurredOn) : '—', theirs: formatDDMMYYYY(existing.occurredOn) },
    { label: t('imports.duplicate.fields.payee'), mine: item.payee ?? '—', theirs: existing.payee ?? '—' },
    { label: t('imports.duplicate.fields.category'), mine: categoryName(item.categoryId) ?? '—', theirs: categoryName(existing.categoryId) ?? '—' },
    {
      label: t('imports.duplicate.fields.source'),
      mine: committed ? t('imports.duplicate.thisFile') : t('imports.duplicate.thisFileUnsaved'),
      theirs: t(`imports.duplicate.sources.${existing.source}`),
    },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
          <View className="flex-row items-center gap-2">
            <Icon as={Copy} className="text-warning size-5" />
            <Text className="text-[17px] font-semibold">{t('imports.duplicate.title')}</Text>
          </View>
          <Text className="text-muted-foreground text-[13px]">
            {t('imports.duplicate.intro')}
          </Text>

          <View className="bg-card border-border overflow-hidden rounded-lg border">
            <View className="flex-row px-4 py-2">
              <View className="w-24" />
              <Text className="text-muted-foreground flex-1 text-[11px] uppercase">{t('imports.duplicate.inFile')}</Text>
              <Text className="text-muted-foreground flex-1 text-[11px] uppercase">{t('imports.duplicate.saved')}</Text>
            </View>
            {rows.map((r, i) => {
              const differs = r.mine !== r.theirs;
              return (
                <Fragment key={r.label}>
                  {i > 0 ? <Separator className="ml-4" /> : null}
                  <View className="flex-row items-start gap-2 px-4 py-2.5">
                    <Text className="text-muted-foreground w-[88px] text-xs">{r.label}</Text>
                    <Text className={cn('flex-1 text-sm', differs && 'font-semibold')}>{r.mine}</Text>
                    <Text className={cn('flex-1 text-sm', differs && 'font-semibold')}>{r.theirs}</Text>
                  </View>
                </Fragment>
              );
            })}
          </View>
          <Text className="text-muted-foreground text-[11px]">{t('imports.duplicate.boldHint')}</Text>

          <Button variant="link" className="self-start px-0" onPress={() => router.push(`/expense/${existing.id}`)}>
            <Text className="text-[15px]">{t('imports.duplicate.open')}</Text>
            <Icon as={ArrowRight} className="text-primary size-4" />
          </Button>

          {busy ? (
            <ActivityIndicator color={theme.primary} />
          ) : committed ? (
            <View className="gap-2">
              <Button variant="outline" size="lg" onPress={onDeleteExisting}>
                <Text>{t('imports.duplicate.keepThis')}</Text>
              </Button>
              <Button variant="outline" size="lg" onPress={onDeleteThis}>
                <Text>{t('imports.duplicate.keepSaved')}</Text>
              </Button>
              <Button variant="ghost" size="lg" onPress={onClose}>
                <Text>{t('imports.duplicate.keepBoth')}</Text>
              </Button>
            </View>
          ) : (
            <View className="gap-2">
              <Button size="lg" onPress={onSkip}>
                <Text>{t('imports.duplicate.skipLine')}</Text>
              </Button>
              <Button variant="outline" size="lg" onPress={onDeleteExisting}>
                <Text>{t('imports.duplicate.importDelete')}</Text>
              </Button>
              <Button variant="ghost" size="lg" onPress={onKeepBoth}>
                <Text>{t('imports.duplicate.importAnyway')}</Text>
              </Button>
            </View>
          )}

          <Button variant="ghost" onPress={onClose} disabled={busy}>
            <Text className="text-muted-foreground">{t('common.close')}</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
