import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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

const UTC_HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TimerScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const activeTimer = useQuery(api.timers.getActiveTimer);
  const tasksWithTime = useQuery(api.timers.getMyTasksWithTime);
  const departments = useQuery(api.departments.getDepartments);
  const settings = useQuery(api.userSettings.getUserSettings);

  const startTimer = useMutation(api.timers.startTimer);
  const pauseTimer = useMutation(api.timers.pauseTimer);
  const updateSettings = useMutation(api.userSettings.updateUserSettings);

  const [elapsed, setElapsed] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [deptFilter, setDeptFilter] = useState<Id<'departments'> | 'all'>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isIOS = Platform.OS === 'ios';
  const insets = useSafeAreaInsets();

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

  // Client-side auto-stop check (fires even when app is open)
  useEffect(() => {
    if (!settings?.autoStopEnabled || !activeTimer) return;
    const checkStop = () => {
      const now = new Date();
      if (now.getUTCHours() === settings.autoStopHour && now.getUTCMinutes() === 0) {
        pauseTimer().catch(() => {});
      }
    };
    const id = setInterval(checkStop, 30000); // check every 30s
    return () => clearInterval(id);
  }, [settings, activeTimer]);

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

  async function toggleAutoStop(val: boolean) {
    await updateSettings({
      autoStopEnabled: val,
      autoStopHour: settings?.autoStopHour ?? 17, // default 17:00 UTC ≈ 18:00 CET
    }).catch(() => {});
  }

  async function setAutoStopHour(h: number) {
    await updateSettings({
      autoStopEnabled: settings?.autoStopEnabled ?? true,
      autoStopHour: h,
    }).catch(() => {});
    setShowHourPicker(false);
  }

  const isRunning = !!activeTimer;
  const activeTask = activeTimer?.task;

  const allTasks = tasksWithTime ?? [];
  const filteredTasks = deptFilter === 'all'
    ? allTasks
    : allTasks.filter((t) => t.departmentId === deptFilter);

  const autoStopHour = settings?.autoStopHour ?? 17;
  const autoStopEnabled = settings?.autoStopEnabled ?? false;

  return (
    <View style={[styles.container, isIOS && styles.containerIOS]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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

      <ScrollView contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic">
        {/* Timer card */}
        <View style={isIOS ? styles.timerCardIOS : styles.timerCard}>
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

        {/* Auto-stop row */}
        <View style={isIOS ? styles.autoStopCardIOS : styles.autoStopCard}>
          <View style={styles.autoStopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.autoStopLabel}>Auto-stop at end of day</Text>
              <Pressable onPress={() => setShowHourPicker(true)} disabled={!autoStopEnabled}>
                <Text style={[styles.autoStopTime, !autoStopEnabled && { color: '#bbb' }]}>
                  {String(autoStopHour).padStart(2, '0')}:00 UTC
                  {autoStopEnabled ? ' · tap to change' : ''}
                </Text>
              </Pressable>
            </View>
            <Switch
              value={autoStopEnabled}
              onValueChange={toggleAutoStop}
              trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Department filter chips */}
        {(departments ?? []).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptChips}>
            <Pressable
              style={[styles.chip, deptFilter === 'all' && styles.chipActive]}
              onPress={() => setDeptFilter('all')}
            >
              <Text style={[styles.chipText, deptFilter === 'all' && styles.chipTextActive]}>All</Text>
            </Pressable>
            {(departments ?? []).map((d) => (
              <Pressable
                key={d._id}
                style={[styles.chip, deptFilter === d._id && styles.chipActive]}
                onPress={() => setDeptFilter(d._id)}
              >
                <Text style={[styles.chipText, deptFilter === d._id && styles.chipTextActive]}>{d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Quick task list */}
        {filteredTasks.length > 0 && (
          <View style={isIOS ? styles.taskListSectionIOS : styles.taskListSection}>
            <Text style={styles.taskListTitle}>My Tasks</Text>
            {filteredTasks.map((task) => {
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
                        {task.status === 'in_progress' ? 'In Progress' : 'To Do'}
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

        {filteredTasks.length === 0 && (
          <View style={styles.noTasks}>
            <Text style={styles.noTasksText}>No tasks to show.</Text>
            <Text style={styles.noTasksHint}>Accept tasks from My Tasks to start timing.</Text>
          </View>
        )}
      </ScrollView>

      {/* Task picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select a task</Text>
            <ScrollView>
              {allTasks.length === 0 && (
                <Text style={styles.emptyText}>No accepted tasks. Accept tasks first.</Text>
              )}
              {allTasks.map((task) => (
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
                    {task.status === 'in_progress' ? 'In Progress' : 'To Do'}
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

      {/* Hour picker modal */}
      <Modal visible={showHourPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Auto-stop hour (UTC)</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {UTC_HOURS.map((h) => (
                <Pressable
                  key={h}
                  style={[styles.hourRow, autoStopHour === h && styles.hourRowActive]}
                  onPress={() => setAutoStopHour(h)}
                >
                  <Text style={[styles.hourText, autoStopHour === h && styles.hourTextActive]}>
                    {String(h).padStart(2, '0')}:00 UTC
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancelBtn} onPress={() => setShowHourPicker(false)}>
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
  containerIOS: { backgroundColor: 'rgba(245,245,245,0.85)' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  scrollContent: { padding: 16, gap: 12, paddingBottom: 120 },

  // Timer card
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
  timerCardIOS: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.8)',
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

  // Auto-stop card
  autoStopCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  autoStopCardIOS: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  autoStopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoStopLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  autoStopTime: { fontSize: 13, color: '#4f46e5', marginTop: 2 },

  // Dept chips
  deptChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#4f46e5' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },

  // Task list
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
  taskListSectionIOS: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
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
    maxHeight: '75%',
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
  hourRow: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  hourRowActive: { backgroundColor: '#ede9fe' },
  hourText: { fontSize: 16, color: '#333' },
  hourTextActive: { color: '#4f46e5', fontWeight: '700' },
});
