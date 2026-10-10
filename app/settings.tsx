import { Redirect } from 'expo-router';

/** The Settings tab became the account hub (E17); old links land there. */
export default function SettingsRedirect() {
  return <Redirect href="/account" />;
}
