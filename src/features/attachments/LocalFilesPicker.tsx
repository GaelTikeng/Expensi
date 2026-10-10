import { ScrollView, View } from 'react-native';

import { Text } from '@/src/components/ui/text';

import { AddTile, FileTile } from './FileTile';
import type { LocalFile } from './pick';
import { useChooseSource } from './useChooseSource';

/**
 * Create flow (F2b.5): files are only picked here; the upload happens after
 * the expense row exists so the attachment can be linked at confirm time.
 */
export function LocalFilesPicker({ files, onChange }: { files: LocalFile[]; onChange: (files: LocalFile[]) => void }) {
  const chooseSource = useChooseSource();
  return (
    <View className="bg-card border-border gap-2 rounded-lg border p-3">
      <Text className="text-[15px] font-semibold">Proof (optional)</Text>
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
      {files.length > 0 ? <Text className="text-muted-foreground text-[11px]">Uploaded after you save · hold to remove</Text> : null}
    </View>
  );
}
