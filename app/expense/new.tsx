import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { FORM_LAYOUTS, FormSkeleton } from '@/src/components/skeletons';
import { LocalFilesPicker } from '@/src/features/attachments/LocalFilesPicker';
import type { LocalFile } from '@/src/features/attachments/pick';
import { enqueue } from '@/src/features/attachments/queue';
import { stageFile, uploadStaged } from '@/src/features/attachments/upload';
import { UploadOverlay } from '@/src/features/attachments/UploadOverlay';
import { expensesApi } from '@/src/features/expenses/api';
import { ExpenseForm } from '@/src/features/expenses/ExpenseForm';
import { useCategories } from '@/src/features/expenses/useCategories';
import { useMe } from '@/src/features/settings/useMe';
import { invalidate } from '@/src/lib/query';

/** F2.5 + F2b.5: create, then upload any picked proofs linked to the new row. */
export default function NewExpenseScreen() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => expensesApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [upload, setUpload] = useState<{ current: number; total: number; progress: number } | null>(null);

  if (catLoading || meLoading || !profile) {
    return <FormSkeleton blocks={FORM_LAYOUTS.expense} />;
  }

  return (
    <>
      <ExpenseForm
        categories={categories}
        currencies={currencies}
        defaultCurrency={profile.defaultCurrency}
        submitLabel="Save expense"
        submitting={submitting}
        extra={<LocalFilesPicker files={files} onChange={setFiles} />}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const saved = await api.create(values);
            void invalidate.expenses(qc);

            let parked = 0;
            for (let i = 0; i < files.length; i++) {
              setUpload({ current: i + 1, total: files.length, progress: 0 });
              try {
                const staged = await stageFile(files[i]);
                try {
                  await uploadStaged(staged, {
                    expenseId: saved.id,
                    getToken,
                    onProgress: (p) => setUpload({ current: i + 1, total: files.length, progress: p }),
                  });
                } catch (err) {
                  await enqueue(staged, saved.id, err);
                  parked++;
                }
              } catch (err) {
                Alert.alert('Skipped a file', err instanceof Error ? err.message : String(err));
              }
            }
            setUpload(null);
            if (files.length > 0) void invalidate.attachments(qc, saved.id);
            if (parked > 0) {
              Alert.alert('Saved', `${parked} file${parked > 1 ? 's' : ''} will upload when you are back online.`);
            }
            router.back();
          } catch (err) {
            setUpload(null);
            Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
          } finally {
            setSubmitting(false);
          }
        }}
      />
      <UploadOverlay visible={upload !== null} current={upload?.current ?? 0} total={upload?.total ?? 0} progress={upload?.progress ?? 0} />
    </>
  );
}
