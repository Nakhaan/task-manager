import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '@/convex/_generated/api';

export default function JoinProjectScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const joinByToken = useMutation(api.projects.joinByToken);
  const [status, setStatus] = useState<'joining' | 'done' | 'error'>('joining');

  useEffect(() => {
    if (!token) return;
    joinByToken({ token })
      .then((projectId) => {
        setStatus('done');
        router.replace(`/project/${projectId}`);
      })
      .catch((e) => {
        setStatus('error');
        Alert.alert('Error', e.message ?? 'Invalid invite token');
      });
  }, [token]);

  return (
    <View style={styles.container}>
      {status === 'joining' && (
        <>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.text}>Joining project…</Text>
        </>
      )}
      {status === 'error' && (
        <Text style={styles.error}>Invalid or expired invite token.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#f5f5f5' },
  text: { fontSize: 16, color: '#666' },
  error: { fontSize: 16, color: '#dc2626', textAlign: 'center', padding: 24 },
});
