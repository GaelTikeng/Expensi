import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';
import { Avatar } from '@/src/components/avatar';
import { FormField } from '@/src/components/form-field';
import { Group, GroupRow } from '@/src/components/group';
import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { pickFromCamera, pickFromLibrary } from '@/src/features/attachments/pick';
import { uploadAvatar } from '@/src/features/profile/avatar';
import { useMe } from '@/src/features/settings/useMe';
import { mePatchSchema } from '@/src/lib/schemas/profile';
import { useThemeColors } from '@/src/lib/theme';

/** E15 F15.2: name, phone and photo. Email comes from the sign-in provider. */
export default function ProfileScreen() {
  const theme = useThemeColors();
  const { getToken } = useAuth();
  const me = useMe();
  const { show, confirm } = useActionSheets();
  const { t } = useTranslation();
  const p = me.profile;

  const [displayName, setDisplayName] = useState(p?.displayName ?? '');
  const [phone, setPhone] = useState(p?.phone ?? '');
  const [errors, setErrors] = useState<{ displayName?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    const parsed = mePatchSchema.safeParse({ displayName: displayName.trim(), phone: phone.trim() || null });
    if (!parsed.success) {
      const next: typeof errors = {};
      // Field-level messages come from the translations, not the shared schema's English text.
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]) as keyof typeof errors;
        next[field] = field === 'phone' ? t('profile.phoneInvalid') : t('profile.nameRequired');
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await me.update(parsed.data);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const setPhoto = async (source: 'camera' | 'library') => {
    try {
      const file = source === 'camera' ? await pickFromCamera() : (await pickFromLibrary())[0];
      if (!file) return;
      setUploading(true);
      const key = await uploadAvatar(file, getToken);
      await me.update({ avatarKey: key });
    } catch (err) {
      Alert.alert(t('profile.updateFailed'), err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const changePhoto = () =>
    show({
      title: t('profile.photoTitle'),
      actions: [
        { label: t('profile.takePhoto'), onPress: () => setPhoto('camera') },
        { label: t('profile.chooseFromLibrary'), onPress: () => setPhoto('library') },
        ...(p?.avatarKey
          ? [
              {
                label: p.imageUrl ? t('profile.useGooglePhoto') : t('profile.removePhoto'),
                destructive: true,
                onPress: async () => {
                  if (await confirm({ title: t('profile.removeConfirm'), actionLabel: t('profile.remove') })) await me.update({ avatarKey: null });
                },
              },
            ]
          : []),
      ],
    });

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <View className="items-center gap-2 py-2">
        <Pressable onPress={changePhoto} disabled={uploading} accessibilityLabel={t('profile.changePhoto')} className="active:opacity-80">
          <Avatar uri={p?.avatarUrl ?? p?.imageUrl} name={p?.displayName ?? p?.email} size={96} />
          <View className="bg-primary border-background absolute -bottom-1 -right-1 size-8 items-center justify-center rounded-full border-2">
            {uploading ? <ActivityIndicator size="small" color={theme.primaryForeground} /> : <Icon as={Camera} className="text-primary-foreground size-4" />}
          </View>
        </Pressable>
        <Text className="text-muted-foreground text-xs">{p?.avatarKey ? t('profile.yourPhoto') : p?.imageUrl ? t('profile.googlePhoto') : t('profile.tapToAdd')}</Text>
      </View>

      <FormField label={t('profile.name')} error={errors.displayName}>
        <Input value={displayName} onChangeText={setDisplayName} placeholder={t('profile.namePlaceholder')} autoCapitalize="words" />
      </FormField>
      <FormField label={t('profile.phone')} error={errors.phone} hint={t('common.optional')}>
        <Input value={phone} onChangeText={setPhone} placeholder="+237 6 90 92 00 54" keyboardType="phone-pad" />
      </FormField>

      <Group footer={t('profile.emailFooter')}>
        <GroupRow label={t('profile.email')} value={p?.email ?? '—'} />
      </Group>

      <Button size="lg" className="mt-2" disabled={saving || uploading} onPress={() => void save()}>
        {saving ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>{t('common.save')}</Text>}
      </Button>
    </ScrollView>
  );
}
