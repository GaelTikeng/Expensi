import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddTile, FileTile } from './FileTile';
import { chooseSource, type LocalFile } from './pick';

/**
 * Create flow (F2b.5): files are only picked here; the upload happens after
 * the expense row exists so the attachment can be linked at confirm time.
 */
export function LocalFilesPicker({ files, onChange }: { files: LocalFile[]; onChange: (files: LocalFile[]) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Proof (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
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
      {files.length > 0 ? <Text style={styles.hint}>Uploaded after you save · hold to remove</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  strip: { gap: 10 },
  hint: { fontSize: 11, color: '#999' },
});
