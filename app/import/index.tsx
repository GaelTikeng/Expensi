import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CloudUpload, FileSpreadsheet, FileText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { importsApi } from '@/src/features/imports/api';
import { pickImportFile, uploadImportFile } from '@/src/features/imports/upload';
import { errorMessage, invalidate, keys, useRefetchOnFocus } from '@/src/lib/query';
import type { ImportDto } from '@/src/lib/schemas/import';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

const EMPTY: ImportDto[] = [];

const STATUS_LABEL: Record<ImportDto['status'], string> = {
  queued: 'Waiting',
  processing: 'Processing…',
  review: 'Ready to review',
  committed: 'Committed',
  failed: 'Failed',
};
const STATUS_CLASS: Record<ImportDto['status'], string> = {
  queued: 'text-muted-foreground',
  processing: 'text-primary',
  review: 'text-warning',
  committed: 'text-success',
  failed: 'text-destructive',
};

/** F3.4 + F3.12: import history and the entry point for a new file. */
export default function ImportsScreen() {
  const theme = useThemeColors();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => importsApi(getToken), [getToken]);
  const [uploading, setUploading] = useState<number | null>(null);

  const query = useQuery({ queryKey: keys.imports.list, queryFn: () => api.list().then((p) => p.items) });
  const items = query.data ?? EMPTY;
  const loading = query.isPending;
  const loadError = errorMessage(query.error);
  // Statuses move on while the user is on the review screen.
  useRefetchOnFocus(keys.imports.all);

  const startImport = async () => {
    try {
      const file = await pickImportFile();
      if (!file) return;
      setUploading(0);
      const created = await uploadImportFile(file, getToken, setUploading);
      setUploading(null);
      void invalidate.imports(qc);
      router.push(`/import/${created.id}`);
    } catch (err) {
      setUploading(null);
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View className="bg-background flex-1 gap-2 p-4">
      <Button size="lg" className="h-12 gap-2.5 rounded-lg" onPress={startImport} disabled={uploading !== null}>
        {uploading !== null ? (
          <>
            <ActivityIndicator color={theme.primaryForeground} />
            <Text className="text-base font-semibold">Uploading {Math.round(uploading * 100)}%</Text>
          </>
        ) : (
          <>
            <Icon as={CloudUpload} className="size-5" />
            <Text className="text-base font-semibold">Import Excel, CSV or PDF</Text>
          </>
        )}
      </Button>
      <Text className="text-muted-foreground mb-2 text-center text-xs">
        Rows are extracted by AI and staged for your review. Nothing is added to your expenses until you confirm.
      </Text>

      {loadError ? <Text className="text-destructive text-center text-[13px]">{loadError}</Text> : null}
      {loading ? (
        // Mirrors the history card: file icon, name + date line, status.
        <View className="bg-card border-border overflow-hidden rounded-lg border" {...loadingA11y}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i}>
              {i > 0 ? <Separator className="ml-12" /> : null}
              <View className="flex-row items-center gap-3 p-3.5">
                <Skeleton className="size-[22px] rounded" />
                <View className="flex-1 gap-2">
                  <SkeletonLine className={cn('h-3.5', ['w-40', 'w-32', 'w-48', 'w-28'][i])} />
                  <SkeletonLine className="w-28" />
                </View>
                <SkeletonLine className="w-16" />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerClassName="bg-card border-border overflow-hidden rounded-lg border"
          ItemSeparatorComponent={() => <Separator className="ml-12" />}
          ListEmptyComponent={<Text className="text-muted-foreground p-6 text-center">No imports yet.</Text>}
          renderItem={({ item }) => (
            <Pressable className="flex-row items-center gap-3 p-3.5 active:bg-accent" onPress={() => router.push(`/import/${item.id}`)}>
              <Icon as={item.sourceType.startsWith('pdf') ? FileText : FileSpreadsheet} className="text-muted-foreground size-[22px]" />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-medium" numberOfLines={1}>
                  {item.originalFilename ?? item.id}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.itemCount ?? 0} lines
                </Text>
              </View>
              <Text className={cn('text-xs font-semibold', STATUS_CLASS[item.status])}>{STATUS_LABEL[item.status]}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
