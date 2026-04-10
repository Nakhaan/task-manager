import { useConvexAuth } from 'convex/react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#999',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '600', color: '#1a1a2e' },
        // iOS Liquid Glass — frosted tab bar only (header stays solid to avoid content overlap)
        tabBarStyle: isIOS
          ? {
              position: 'absolute',
              borderTopWidth: 0,
              backgroundColor: 'transparent',
              elevation: 0,
            }
          : { borderTopColor: '#e0e0e0' },
        tabBarBackground: isIOS
          ? () => (
              <BlurView
                intensity={80}
                tint="systemChromeMaterial"
                style={StyleSheet.absoluteFill}
              />
            )
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timer',
          headerShown: false, // Timer screen has its own custom header
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="timer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'My Tasks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens — keep routing intact */}
      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
