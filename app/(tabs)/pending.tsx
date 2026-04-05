import { useMutation, useQuery } from 'convex/react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export default function PendingScreen() {
  const pendingTasks = useQuery(api.tasks.getPendingTasks);
  const acceptTask = useMutation(api.tasks.acceptTask);
  const rejectTask = useMutation(api.tasks.rejectTask);

  async function handleAccept(taskId: Id<'tasks'>) {
    try {
      await acceptTask({ taskId });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleReject(taskId: Id<'tasks'>) {
    try {
      await rejectTask({ taskId });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionTitle}>Waiting for Acceptance</Text>
        <Text style={styles.subtitle}>
          These tasks have been assigned to you.
        </Text>

        {(pendingTasks ?? []).length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No pending tasks.</Text>
          </View>
        )}

        {(pendingTasks ?? []).map((task) => (
          <View key={task._id} style={styles.card}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            {task.description ? (
              <Text style={styles.cardDesc}>{task.description}</Text>
            ) : null}
            <View style={styles.cardActions}>
              <Pressable style={styles.acceptBtn} onPress={() => handleAccept(task._id)}>
                <Text style={styles.acceptBtnText}>✓  Accept</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => handleReject(task._id)}>
                <Text style={styles.rejectBtnText}>✕  Decline</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  cardDesc: { fontSize: 14, color: '#666' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  acceptBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rejectBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
});
