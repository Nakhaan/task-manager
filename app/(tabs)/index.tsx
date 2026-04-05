import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useAuthActions } from '@convex-dev/auth/react';

function formatHHMMSS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
}

const STATUS_COLOR: Record<string, string> = {
  accepted: '#4f46e5',
  in_progress: '#059669',
  completed: '#6b7280',
};

export default function TimerScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const activeTimer = useQuery(api.timers.getActiveTimer);
  const tasksWithTime = useQuery(api.timers.getMyTasksWithTime);

  const startTimer = useMutation(api.timers.startTimer);
  const pauseTimer = useMutation(api.timers.pauseTimer);

  const [elapsed, setElapsed] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeTimer?.startTime) {
      const previousMs = activeTimer.previousMs ?? 0;
      const tick = () => setElapsed(previousMs + (Date.now() - activeTimer.startTime));
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer?.startTime, activeTimer?.taskId, activeTimer?.previousMs]);

  async function handleStart(taskId: Id<'tasks'>) {
    setShowPicker(false);
    try {
      await startTimer({ taskId });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handlePause() {
    try {
      await pauseTimer();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const isRunning = !!activeTimer;
  const activeTask = activeTimer?.task;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {currentUser?.name ?? '…'}</Text>
        <View style={styles.headerActions}>
          {currentUser?.role === 'admin' && (
            <>
              <Pressable onPress={() => router.push('/admin/users')} style={styles.adminBtn}>
                <Text style={styles.adminBtnText}>Users</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/admin/departments')} style={styles.adminBtn}>
                <Text style={styles.adminBtnText}>Depts</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={() => signOut()} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Timer card */}
        <View style={styles.timerCard}>
          <Text style={styles.taskLabel}>
            {activeTask ? activeTask.title : 'No task running'}
          </Text>
          <Text style={styles.timerText}>{formatHHMMSS(elapsed)}</Text>

          <View style={styles.timerActions}>
            {isRunning ? (
              <Pressable style={[styles.timerBtn, styles.pauseBtn]} onPress={handlePause}>
                <Text style={styles.timerBtnText}>⏸  Pause</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.timerBtn, styles.startBtn]} onPress={() => setShowPicker(true)}>
                <Text style={styles.timerBtnText}>▶  Start Task</Text>
              </Pressable>
            )}
            {isRunning && (
              <Pressable style={[styles.timerBtn, styles.switchBtn]} onPress={() => setShowPicker(true)}>
                <Text style={[styles.timerBtnText, { color: '#1a1a2e' }]}>⇄  Switch</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick task list */}
        {(tasksWithTime ?? []).length > 0 && (
          <View style={styles.taskListSection}>
            <Text style={styles.taskListTitle}>My Tasks</Text>
            {(tasksWithTime ?? []).map((task) => {
              const isActive = activeTimer?.taskId === task._id;
              const displayTime = isActive ? elapsed : task.totalMs;
              return (
                <View
                  key={task._id}
                  style={[styles.taskRow, isActive && styles.taskRowActive]}
                >
                  <View style={styles.taskRowLeft}>
                    <Text style={styles.taskRowName} numberOfLines={1}>{task.title}</Text>
                    <View style={styles.taskRowMeta}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[task.status] ?? '#999' }]} />
                      <Text style={styles.taskRowStatus}>
                        {task.status === 'in_progress' ? 'In Progress' : 'Accepted'}
                      </Text>
                      <Text style={styles.taskRowTime}>· {formatShort(displayTime)}</Text>
                    </View>
                  </View>
                  {isActive ? (
                    <Pressable style={styles.pauseSmallBtn} onPress={handlePause}>
                      <Text style={styles.pauseSmallBtnText}>⏸</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.startSmallBtn} onPress={() => handleStart(task._id)}>
                      <Text style={styles.startSmallBtnText}>▶</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {(tasksWithTime ?? []).length === 0 && (
          <View style={styles.noTasks}>
            <Text style={styles.noTasksText}>No accepted tasks yet.</Text>
            <Text style={styles.noTasksHint}>Go to Projects to create or accept tasks.</Text>
          </View>
        )}
      </ScrollView>

      {/* Task picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select a task</Text>
            <ScrollView>
              {(tasksWithTime ?? []).length === 0 && (
                <Text style={styles.emptyText}>No accepted tasks. Accept tasks first.</Text>
              )}
              {(tasksWithTime ?? []).map((task) => (
                <Pressable
                  key={task._id}
                  style={[
                    styles.taskOption,
                    activeTimer?.taskId === task._id && styles.taskOptionActive,
                  ]}
                  onPress={() => handleStart(task._id)}
                >
                  <View style={styles.taskOptionLeft}>
                    <Text style={styles.taskOptionTitle}>{task.title}</Text>
                    <Text style={styles.taskOptionTime}>{formatShort(task.totalMs)} spent</Text>
                  </View>
                  <Text style={styles.taskOptionStatus}>
                    {task.status === 'in_progress' ? 'In Progress' : 'Accepted'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  greeting: { fontSize: 18, fontWeight: '600', color: '#1a1a2e' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  adminBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  signOutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  signOutText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  timerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  taskLabel: { fontSize: 15, color: '#666', marginBottom: 10, textAlign: 'center' },
  timerText: {
    fontSize: 60,
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: 2,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  timerActions: { flexDirection: 'row', gap: 12 },
  timerBtn: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    minWidth: 120,
    alignItems: 'center',
  },
  startBtn: { backgroundColor: '#4f46e5' },
  pauseBtn: { backgroundColor: '#f59e0b' },
  switchBtn: { backgroundColor: '#e5e7eb' },
  timerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Quick task list
  taskListSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  taskListTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    gap: 8,
  },
  taskRowActive: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  taskRowLeft: { flex: 1, gap: 3 },
  taskRowName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  taskRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  taskRowStatus: { fontSize: 12, color: '#666' },
  taskRowTime: { fontSize: 12, color: '#888' },
  startSmallBtn: {
    backgroundColor: '#4f46e5',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startSmallBtnText: { color: '#fff', fontSize: 13 },
  pauseSmallBtn: {
    backgroundColor: '#f59e0b',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseSmallBtnText: { color: '#fff', fontSize: 13 },
  noTasks: { alignItems: 'center', paddingTop: 16, gap: 6 },
  noTasksText: { fontSize: 15, color: '#999', fontWeight: '500' },
  noTasksHint: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#1a1a2e' },
  taskOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskOptionActive: { backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#4f46e5' },
  taskOptionLeft: { flex: 1, gap: 2 },
  taskOptionTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a2e' },
  taskOptionTime: { fontSize: 12, color: '#888' },
  taskOptionStatus: { fontSize: 12, color: '#666', marginLeft: 8 },
  emptyText: { color: '#999', textAlign: 'center', marginTop: 16 },
  cancelBtn: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 16 },
});
