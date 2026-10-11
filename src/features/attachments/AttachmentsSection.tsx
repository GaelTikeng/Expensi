import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';

import { TileStripSkeleton } from '@/src/components/skeletons';
import { Text } from '@/src/components/ui/text';

import type { AttachmentDto } from '@/src/lib/schemas/attachment';
import { ImageViewerModal, openAttachment } from './AttachmentViewer';
import { AddTile, FileTile } from './FileTile';
import { useChooseSource } from './useChooseSource';
import { useAttachments } from './useAttachments';
import { useTranslation } from 'react-i18next';
import { pluralKey } from '@/src/i18n';

/** F2b.5 / F2b.6 for an existing expense: strip of proofs with add, view, delete. */
export function AttachmentsSection({ expenseId }: { expenseId: string }) {
  const { t } = useTranslation();
  const { items, uploading, queued, loading, error, add, remove, api } = useAttachments(expenseId);
  const [viewer, setViewer] = useState<{ attachment: AttachmentDto; url: string } | null>(null);
  const chooseSource = useChooseSource();
  const { confirm } = useActionSheets();

  const open = async (a: AttachmentDto) => {
    try {
      const url = a.url ?? (await api.url(a.id)).url;
      await openAttachment(a, url, (att, u) => setViewer({ attachment: att, url: u }));
    } catch (err) {
      Alert.alert(t('attachments.couldNotOpen'), err instanceof Error ? err.message : String(err));
    }
  };

  const confirmRemove = async (a: AttachmentDto) => {
    if (await confirm({ title: t('attachments.removeConfirm'), message: a.originalFilename ?? undefined, actionLabel: t('common.remove') })) void remove(a.id);
  };

  return (
    <View className="bg-card border-border gap-2 rounded-lg border p-3">
      <View className="flex-row justify-between">
        <Text className="text-[15px] font-semibold">{t('attachments.proof')}</Text>
        <Text className="text-muted-foreground text-[13px]">
          {t(pluralKey('attachments.files', items.length), { n: items.length })}
        </Text>
      </View>
      {loading ? (
        <TileStripSkeleton />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
          <AddTile onPress={() => chooseSource((files) => void add(files))} />
          {uploading.map((u) => (
            <FileTile key={u.file.attachmentId} kind={u.file.kind} uri={u.file.uri} label={u.file.name} progress={u.progress} />
          ))}
          {queued.map((q) => (
            <FileTile key={q.file.attachmentId} kind={q.file.kind} uri={q.file.uri} label={q.file.name} queued />
          ))}
          {items.map((a) => (
            <FileTile
              key={a.id}
              kind={a.kind}
              uri={a.url}
              label={a.originalFilename}
              onPress={() => open(a)}
              onLongPress={() => confirmRemove(a)}
            />
          ))}
        </ScrollView>
      )}
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
      <Text className="text-muted-foreground text-[11px]">{t('attachments.tapToView')}</Text>

      <ImageViewerModal attachment={viewer?.attachment ?? null} url={viewer?.url ?? null} onClose={() => setViewer(null)} />
    </View>
  );
}
