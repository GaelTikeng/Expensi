import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { useUploadQueueFlush } from '@/src/features/attachments/useUploadQueueFlush';
import { useNotificationSetup } from '@/src/features/notifications/useNotificationSetup';

/**
 * Signed-in shell.
 */
export default function TabsLayout() {
  useUploadQueueFlush();
  useNotificationSetup();
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
          headerRight: () => (
            <Pressable onPress={() => router.push('/import')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Import a file">
              <Ionicons name="cloud-upload-outline" size={22} color="#1F5EFF" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="recaps"
        options={{
          title: 'Recaps',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color} size={size} />,
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
