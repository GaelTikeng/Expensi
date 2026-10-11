import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { Group } from '@/src/components/group';
import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';
import { DateField } from '@/src/features/expenses/DateField';
import { exportApi, type ExportRange } from '@/src/features/export/api';
import { downloadExport } from '@/src/features/export/download';
import { currencyInfo } from '@/src/lib/currencies';
import { endOfMonth, formatDDMMYYYY, previousPeriodStart, startOfMonth, todayISO, type ISODate } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';
import { errorMessage, keys } from '@/src/lib/query';
import type { ExportFormat } from '@/src/lib/schemas/export';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';
import { useTranslation } from 'react-i18next';
import { pluralKey } from '@/src/i18n';

type Preset = 'this-month' | 'last-month' | 'this-year' | 'custom';

const PRESETS = [
  { key: 'this-month', label: 'exportScreen.presets.thisMonth' },
  { key: 'last-month', label: 'exportScreen.presets.lastMonth' },
  { key: 'this-year', label: 'exportScreen.presets.thisYear' },
  { key: 'custom', label: 'exportScreen.presets.custom' },
] as const satisfies readonly { key: Preset; label: `exportScreen.presets.${string}` }[];

function presetRange(preset: Preset, today: ISODate): { from: ISODate; to: ISODate } {
  const monthStart = startOfMonth(today);
  switch (preset) {
    case 'this-month':
      return { from: monthStart, to: endOfMonth(monthStart) };
    case 'last-month': {
      const prev = previousPeriodStart('month', monthStart);
      return { from: prev, to: endOfMonth(prev) };
    }
    case 'this-year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'custom':
      return { from: monthStart, to: today };
  }
}

/** E10 F10.4: pick a range and a format, see what it holds, get the file. */
export default function ExportScreen() {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { getToken } = useAuth();
  const api = useMemo(() => exportApi(getToken), [getToken]);
  const today = todayISO();

  const [preset, setPreset] = useState<Preset>('this-month');
  const [custom, setCustom] = useState<{ from: ISODate; to: ISODate }>(() => presetRange('custom', today));
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);

  const range: ExportRange = preset === 'custom' ? custom : presetRange(preset, today);
  const reversed = range.from > range.to;

  const summary = useQuery({
    queryKey: keys.exportSummary(range.from, range.to),
    queryFn: () => api.summary(range),
    enabled: !reversed,
  });

  const preview = summary.data
    ? summary.data.count === 0
      ? t('exportScreen.empty')
      : `${t(pluralKey('exportScreen.count', summary.data.count), { n: summary.data.count })} · ${summary.data.byCurrency.map((c) => formatMoney(c.totalMinor, currencyInfo(c.currency))).join(' · ')}`
    : null;

  const run = async () => {
    setBusy(true);
    try {
      await downloadExport(range, format, getToken);
    } catch (err) {
      Alert.alert(t('exportScreen.failed'), err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12">
      <View className="gap-1.5">
        <Text className="text-muted-foreground ml-1 text-xs uppercase tracking-wide">{t('exportScreen.period')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={preset === p.key ? 'default' : 'outline'}
              size="sm"
              className="h-8 rounded-full px-3"
              onPress={() => setPreset(p.key)}
              accessibilityState={{ selected: preset === p.key }}
            >
              <Text className="text-[13px]">{t(p.label)}</Text>
            </Button>
          ))}
        </View>
      </View>

      {preset === 'custom' ? (
        <Group footer={reversed ? t('exportScreen.reversed') : undefined}>
          <View className="px-4 py-3">
            <DateField label={t('exportScreen.from')} value={custom.from} onChange={(d) => d && setCustom((c) => ({ ...c, from: d }))} />
          </View>
          <View className="px-4 py-3">
            <DateField label={t('exportScreen.to')} value={custom.to} onChange={(d) => d && setCustom((c) => ({ ...c, to: d }))} />
          </View>
        </Group>
      ) : null}

      <View className="bg-card border-border gap-1 rounded-lg border p-4">
        <Text className="text-muted-foreground text-xs uppercase tracking-wide">
          {formatDDMMYYYY(range.from)} – {formatDDMMYYYY(range.to)}
        </Text>
        {summary.isPending && !reversed ? (
          <ActivityIndicator className="self-start" color={theme.mutedForeground} />
        ) : summary.error ? (
          <Text className="text-destructive text-[13px]">{errorMessage(summary.error)}</Text>
        ) : (
          <Text className={cn('text-[15px] font-medium', summary.data?.count === 0 && 'text-muted-foreground')}>{preview}</Text>
        )}
      </View>

      <View className="gap-1.5">
        <Text className="text-muted-foreground ml-1 text-xs uppercase tracking-wide">{t('exportScreen.format')}</Text>
        <ToggleGroup
          type="single"
          value={format}
          onValueChange={(v) => {
            if (v) setFormat(v as ExportFormat);
          }}
          className="bg-muted rounded-lg p-[3px]"
        >
          {(
            [
              ['pdf', t('exportScreen.pdf'), FileText],
              ['xlsx', t('exportScreen.excel'), FileSpreadsheet],
            ] as const
          ).map(([k, label, icon]) => (
            <ToggleGroupItem key={k} value={k} aria-label={label} className={cn('h-10 flex-1 flex-row gap-1.5 rounded-md', format === k ? 'bg-card shadow-sm shadow-black/5' : 'bg-transparent')}>
              <Icon as={icon} className={cn('size-4', format === k ? 'text-foreground' : 'text-muted-foreground')} />
              <Text className={cn('text-[13px]', format === k ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal')}>{label}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Text className="text-muted-foreground ml-1 text-xs">
          {format === 'pdf' ? t('exportScreen.pdfHint') : t('exportScreen.excelHint')}
        </Text>
      </View>

      <Button size="lg" className="mt-2 gap-2" disabled={busy || reversed || summary.data?.count === 0} onPress={() => void run()}>
        {busy ? <ActivityIndicator color={theme.primaryForeground} /> : <Icon as={Download} className="text-primary-foreground size-5" />}
        <Text>{busy ? t('exportScreen.preparing') : format === 'pdf' ? t('exportScreen.exportPdf') : t('exportScreen.exportExcel')}</Text>
      </Button>
    </ScrollView>
  );
}
