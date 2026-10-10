import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';

import { Group } from '@/src/components/group';
import { Progress } from '@/src/components/ui/progress';
import { Text } from '@/src/components/ui/text';
import { apiFetch } from '@/src/lib/api';
import { keys, useRefetchOnFocus } from '@/src/lib/query';

interface Usage {
  extract: { used: number; limit: number };
  narrative: { used: number; limit: number };
}

/** E17 / F7.6: this month's AI calls against the monthly limits. */
export default function UsageScreen() {
  const { getToken } = useAuth();
  const usage = useQuery({ queryKey: keys.usage, queryFn: () => apiFetch<Usage>('/api/usage', getToken) }).data ?? null;
  useRefetchOnFocus(keys.usage);
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4 pb-12">
      <Group title="This month" footer="Counts start again on the 1st of each month.">
        <UsageRow label="File imports" used={usage?.extract.used} limit={usage?.extract.limit} />
        <UsageRow label="Recap summaries" used={usage?.narrative.used} limit={usage?.narrative.limit} />
      </Group>
    </ScrollView>
  );
}

function UsageRow({ label, used, limit }: { label: string; used?: number; limit?: number }) {
  const pct = used != null && limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row justify-between">
        <Text className="text-[15px]">{label}</Text>
        <Text className="text-muted-foreground text-[15px]">{used != null && limit != null ? `${used} / ${limit}` : '…'}</Text>
      </View>
      <Progress value={pct} className="h-1.5" />
    </View>
  );
}
