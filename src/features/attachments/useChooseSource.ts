import { useCallback } from 'react';

import { useActionSheets } from '@/src/components/action-sheet';
import { pickFromCamera, pickFromLibrary, pickPdf, type LocalFile } from './pick';
import { t } from '@/src/i18n';

/** "Add proof" source chooser as an action sheet: camera, photo library, PDF. */
export function useChooseSource() {
  const { show } = useActionSheets();
  return useCallback(
    (onPicked: (files: LocalFile[]) => void) =>
      show({
        title: t('attachments.addProof'),
        actions: [
          {
            label: t('attachments.takePhoto'),
            onPress: async () => {
              const f = await pickFromCamera();
              if (f) onPicked([f]);
            },
          },
          { label: t('attachments.choosePhoto'), onPress: async () => onPicked(await pickFromLibrary()) },
          { label: t('attachments.choosePdf'), onPress: async () => onPicked(await pickPdf()) },
        ],
      }),
    [show],
  );
}
