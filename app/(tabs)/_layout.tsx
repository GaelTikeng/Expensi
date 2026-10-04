import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useUploadQueueFlush } from '@/src/features/attachments/useUploadQueueFlush';

/**
 * Signed-in shell. E5 adds Plan, E4 adds Recaps.
 */
export default function TabsLayout() {
  useUploadQueueFlush();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#1F5EFF' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
