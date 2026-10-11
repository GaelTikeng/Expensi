import { ScrollView, View } from 'react-native';

import { Text } from '@/src/components/ui/text';

import { AddTile, FileTile } from './FileTile';
import type { LocalFile } from './pick';
import { useChooseSource } from './useChooseSource';
import { useTranslation } from 'react-i18next';

/**
 * Create flow (F2b.5): files are only picked here; the upload happens after
 * the expense row exists so the attachment can be linked at confirm time.
 */
export function LocalFilesPicker({ files, onChange }: { files: LocalFile[]; onChange: (files: LocalFile[]) => void }) {
  const { t } = useTranslation();
  const chooseSource = useChooseSource();
  return (
    <View className="bg-card border-border gap-2 rounded-lg border p-3">
      <Text className="text-[15px] font-semibold">{t('attachments.proofOptional')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
        <AddTile onPress={() => chooseSource((picked) => onChange([...files, ...picked]))} />
        {files.map((f, i) => (
          <FileTile
            key={`${f.uri}-${i}`}
            kind={f.kind}
            uri={f.uri}
            label={f.name}
            onLongPress={() => onChange(files.filter((_, j) => j !== i))}
          />
        ))}
      </ScrollView>
      {files.length > 0 ? <Text className="text-muted-foreground text-[11px]">{t('attachments.uploadedAfterSave')}</Text> : null}
    </View>
  );
}
