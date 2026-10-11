import { MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { GroupRow } from '@/src/components/group';
import { Icon } from '@/src/components/ui/icon';
import { Switch } from '@/src/components/ui/switch';
import { getPrefs, setPrefs } from '@/src/lib/prefs';
import { useThemeColors } from '@/src/lib/theme';
import { capturePlace, ensureLocationPermission, type ExpensePlace } from './capture';
import { useTranslation } from 'react-i18next';

/**
 * E16 F16.2: "Save my location" row for the expense form. Turning it on asks
 * for permission, takes one fix and reports it through `onChange`; the
 * choice is remembered per device so a new expense captures on open.
 */
export function LocationField({ value, onChange, isNew }: { value: ExpensePlace | null; onChange: (place: ExpensePlace | null) => void; isNew: boolean }) {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const capture = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await ensureLocationPermission())) {
        onChange(null);
        return;
      }
      onChange(await capturePlace());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      onChange(null);
    } finally {
      setBusy(false);
    }
  }, [onChange]);

  // A new expense captures on open when the user chose to last time.
  useEffect(() => {
    if (!isNew || autoRan.current) return;
    autoRan.current = true;
    void getPrefs().then((p) => {
      if (p.saveLocation) void capture();
    });
  }, [isNew, capture]);

  const toggle = async (on: boolean) => {
    void setPrefs({ saveLocation: on });
    if (on) await capture();
    else {
      setError(null);
      onChange(null);
    }
  };

  const on = busy || value !== null;
  const status = busy ? t('location.finding') : error ? error : value ? (value.locationLabel ?? `${value.latitude}, ${value.longitude}`) : t('common.off');

  return (
    <GroupRow
      label={t('location.save')}
      description={status}
      right={
        <View className="flex-row items-center gap-2">
          {busy ? <ActivityIndicator size="small" color={theme.mutedForeground} /> : value ? <Icon as={MapPin} className="text-primary size-4" /> : null}
          <Switch checked={on} onCheckedChange={(v) => void toggle(v)} disabled={busy} accessibilityLabel={t('location.save')} />
        </View>
      }
    />
  );
}
