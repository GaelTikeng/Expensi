import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { kindForMime, type AttachmentKind } from '@/src/lib/schemas/attachment';

/** A file on this device, before upload. */
export interface LocalFile {
  uri: string;
  mimeType: string;
  name: string;
  sizeBytes?: number;
  kind: AttachmentKind;
}

function fromImageAsset(a: ImagePicker.ImagePickerAsset): LocalFile {
  const mimeType = a.mimeType ?? 'image/jpeg';
  return {
    uri: a.uri,
    mimeType,
    name: a.fileName ?? `photo-${Date.now()}.jpg`,
    sizeBytes: a.fileSize,
    kind: kindForMime(mimeType),
  };
}

export async function pickFromCamera(): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph receipts.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  return res.canceled || !res.assets[0] ? null : fromImageAsset(res.assets[0]);
}

export async function pickFromLibrary(): Promise<LocalFile[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo access needed', 'Allow photo access in Settings to attach receipts.');
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 5 });
  return res.canceled ? [] : res.assets.map(fromImageAsset);
}

export async function pickPdf(): Promise<LocalFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    mimeType: a.mimeType ?? 'application/pdf',
    name: a.name,
    sizeBytes: a.size,
    kind: 'pdf' as const,
  }));
}
