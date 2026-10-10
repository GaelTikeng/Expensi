import { useCallback } from 'react';

import { useActionSheets } from '@/src/components/action-sheet';
import { pickFromCamera, pickFromLibrary, pickPdf, type LocalFile } from './pick';

/** "Add proof" source chooser as an action sheet: camera, photo library, PDF. */
export function useChooseSource() {
  const { show } = useActionSheets();
  return useCallback(
    (onPicked: (files: LocalFile[]) => void) =>
      show({
        title: 'Add proof',
        actions: [
          {
            label: 'Take photo',
            onPress: async () => {
              const f = await pickFromCamera();
              if (f) onPicked([f]);
            },
          },
          { label: 'Choose photo', onPress: async () => onPicked(await pickFromLibrary()) },
          { label: 'Choose PDF', onPress: async () => onPicked(await pickPdf()) },
        ],
      }),
    [show],
  );
}
