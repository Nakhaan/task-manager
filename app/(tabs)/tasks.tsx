import { useMutation, useQuery } from 'convex/react';
import { useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { api } from '@/convex/_generated/api';
import { Id, Doc } from '@/convex/_generated/dataModel';

type Task = Doc<'tasks'>;

const STATUS_COLORS: Record<string, string> = {
  accepted: '#4f46e5',
  in_progress: '#059669',
  completed: '#6b7280',
  pending_acceptance: '#f59e0b',
};
const STATUS_LABELS: Record<string, string> = {
  accepted: 'To Do',
  in_progress: 'In Progress',
  completed: 'Done',
  pending_acceptance: 'Pending',
};

type StatusFilter = 'all' | 'active' | 'done';

function formatShort(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(Math.abs(ms) / 1000)}s`;
}

export default function TasksScreen() {
  const navigation = useNavigation();

  const myAllTasks = useQuery(api.tasks.getMyAllTasks);
  const pendingTasks = useQuery(api.tasks.getPendingTasks);
  const departments = useQuery(api.departments.getDepartments);

  const startTimer = useMutation(api.timers.startTimer);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const acceptTask = useMutation(api.tasks.acceptTask);
  const rejectTask = useMutation(api.tasks.rejectTask);
  const addManualTime = useMutation(api.timers.addManualTimeEntry);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [deptFilter, setDeptFilter] = useState<Id<'departments'> | 'all'>('all');

  // Edit task modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<Task['status']>('accepted');
  const [editDept, setEditDept] = useState<Id<'departments'> | undefined>();
  const [timeAdjust, setTimeAdjust] = useState('');

  // Pending modal
  const [showPending, setShowPending] = useState(false);

  const pendingCount = (pendingTasks ?? []).length;

  // Inject pending button into the tab header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          style={styles.pendingBtn}
          onPress={() => setShowPending(true)}
        >
          <Ionicons name="hourglass-outline" size={18} color="#f59e0b" />
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </Pressable>
      ),
    });
  }, [navigation, pendingCount]);

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditStatus(task.status === 'in_progress' ? 'in_progress' : task.status);
    setEditDept(task.departmentId);
    setTimeAdjust('');
  }

  async function handleSave() {
    if (!editingTask || !editTitle.trim()) return;
    try {
      await updateTask({
        taskId: editingTask._id,
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        status: editStatus,
        departmentId: editDept,
      });

      const minutes = parseFloat(timeAdjust);
      if (!isNaN(minutes) && minutes !== 0) {
        await addManualTime({ taskId: editingTask._id, durationMinutes: minutes });
      }

      setEditingTask(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleDelete(task: Task) {
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask({ taskId: task._id });
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function handleStart(taskId: Id<'tasks'>) {
    try {
      await startTimer({ taskId });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

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

  const allTasks = myAllTasks ?? [];

  const filtered = allTasks.filter((t) => {
    const statusOk =
      statusFilter === 'active'
        ? t.status !== 'completed'
        : statusFilter === 'done'
          ? t.status === 'completed'
          : true;
    const deptOk = deptFilter === 'all' || t.departmentId === deptFilter;
    return statusOk && deptOk;
  });

  const editableStatuses: Array<{ value: Task['status']; label: string }> = [
    { value: 'accepted', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Done' },
  ];

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={[styles.container, isIOS && styles.containerIOS]}>
      {/* Status filter chips */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(['active', 'done', 'all'] as StatusFilter[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, statusFilter === f && styles.chipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>
                {f === 'active' ? 'Active' : f === 'done' ? 'Done' : 'All'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Department filter chips */}
        {(departments ?? []).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable
              style={[styles.chip, deptFilter === 'all' && styles.chipActive]}
              onPress={() => setDeptFilter('all')}
            >
              <Text style={[styles.chipText, deptFilter === 'all' && styles.chipTextActive]}>
                All Depts
              </Text>
            </Pressable>
            {(departments ?? []).map((d) => (
              <Pressable
                key={d._id}
                style={[styles.chip, deptFilter === d._id && styles.chipActive]}
                onPress={() => setDeptFilter(d._id)}
              >
                <Text style={[styles.chipText, deptFilter === d._id && styles.chipTextActive]}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} contentInsetAdjustmentBehavior="automatic">
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {statusFilter === 'done' ? 'No completed tasks.' : 'No active tasks.'}
            </Text>
            {statusFilter === 'active' && (
              <Text style={styles.emptyHint}>Accept tasks via the pending button above.</Text>
            )}
          </View>
        )}

        {filtered.map((task) => (
          <View key={task._id} style={isIOS ? styles.cardIOS : styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
              <View style={[styles.badge2, { backgroundColor: STATUS_COLORS[task.status] + '22' }]}>
                <Text style={[styles.badgeText2, { color: STATUS_COLORS[task.status] }]}>
                  {STATUS_LABELS[task.status]}
                </Text>
              </View>
            </View>
            {task.description ? (
              <Text style={styles.cardDesc}>{task.description}</Text>
            ) : null}
            {task.departmentId && (departments ?? []).find(d => d._id === task.departmentId) && (
              <Text style={styles.cardDept}>
                {(departments ?? []).find(d => d._id === task.departmentId)?.name}
              </Text>
            )}
            <View style={styles.cardActions}>
              {task.status !== 'completed' && (
                <Pressable style={styles.startBtn} onPress={() => handleStart(task._id)}>
                  <Text style={styles.startBtnText}>▶  Start</Text>
                </Pressable>
              )}
              <Pressable style={styles.editBtn} onPress={() => openEdit(task)}>
                <Text style={styles.editBtnText}>✎  Edit</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(task)}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Edit modal ─────────────────────────────────────── */}
      <Modal visible={!!editingTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {isIOS ? (
            <BlurView intensity={60} tint="systemChromeMaterial" style={styles.modalSheetIOS}>
              <EditModalContent
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                editStatus={editStatus}
                setEditStatus={setEditStatus}
                editDept={editDept}
                setEditDept={setEditDept}
                timeAdjust={timeAdjust}
                setTimeAdjust={setTimeAdjust}
                editableStatuses={editableStatuses}
                departments={departments ?? []}
                onCancel={() => setEditingTask(null)}
                onSave={handleSave}
              />
            </BlurView>
          ) : (
            <View style={styles.modalSheet}>
              <EditModalContent
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                editStatus={editStatus}
                setEditStatus={setEditStatus}
                editDept={editDept}
                setEditDept={setEditDept}
                timeAdjust={timeAdjust}
                setTimeAdjust={setTimeAdjust}
                editableStatuses={editableStatuses}
                departments={departments ?? []}
                onCancel={() => setEditingTask(null)}
                onSave={handleSave}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* ── Pending tasks modal ────────────────────────────── */}
      <Modal visible={showPending} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Pending Acceptance</Text>
              <Pressable onPress={() => setShowPending(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {(pendingTasks ?? []).length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No pending tasks.</Text>
                </View>
              )}
              {(pendingTasks ?? []).map((task) => (
                <View key={task._id} style={styles.pendingCard}>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                  {task.description ? (
                    <Text style={styles.cardDesc}>{task.description}</Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.acceptBtn}
                      onPress={() => handleAccept(task._id)}
                    >
                      <Text style={styles.acceptBtnText}>✓  Accept</Text>
                    </Pressable>
                    <Pressable
                      style={styles.rejectBtn}
                      onPress={() => handleReject(task._id)}
                    >
                      <Text style={styles.rejectBtnText}>✕  Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Extracted edit form so it works inside both BlurView and plain View ──
type EditProps = {
  editTitle: string;
  setEditTitle: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editStatus: Task['status'];
  setEditStatus: (v: Task['status']) => void;
  editDept: Id<'departments'> | undefined;
  setEditDept: (v: Id<'departments'> | undefined) => void;
  timeAdjust: string;
  setTimeAdjust: (v: string) => void;
  editableStatuses: Array<{ value: Task['status']; label: string }>;
  departments: Doc<'departments'>[];
  onCancel: () => void;
  onSave: () => void;
};

function EditModalContent(p: EditProps) {
  return (
    <>
      <Text style={styles.modalTitle}>Edit Task</Text>
      <TextInput
        style={styles.input}
        value={p.editTitle}
        onChangeText={p.setEditTitle}
        placeholder="Task title"
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={p.editDesc}
        onChangeText={p.setEditDesc}
        placeholder="Description (optional)"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.fieldLabel}>Status</Text>
      <View style={styles.chipRow}>
        {p.editableStatuses.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.chip, p.editStatus === s.value && styles.chipActive]}
            onPress={() => p.setEditStatus(s.value)}
          >
            <Text style={[styles.chipText, p.editStatus === s.value && styles.chipTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Department</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, !p.editDept && styles.chipActive]}
            onPress={() => p.setEditDept(undefined)}
          >
            <Text style={[styles.chipText, !p.editDept && styles.chipTextActive]}>None</Text>
          </Pressable>
          {p.departments.map((d) => (
            <Pressable
              key={d._id}
              style={[styles.chip, p.editDept === d._id && styles.chipActive]}
              onPress={() => p.setEditDept(d._id)}
            >
              <Text style={[styles.chipText, p.editDept === d._id && styles.chipTextActive]}>
                {d.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.fieldLabel}>Adjust Time (minutes)</Text>
      <View style={styles.timeAdjustRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={p.timeAdjust}
          onChangeText={p.setTimeAdjust}
          placeholder="e.g. +30 or -15"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.timeHint}>Positive adds, negative subtracts</Text>
      </View>

      <View style={styles.modalActions}>
        <Pressable style={styles.cancelBtn} onPress={p.onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={p.onSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  containerIOS: { backgroundColor: 'rgba(245,245,245,0.85)' },
  filterSection: { paddingTop: 8, gap: 4, backgroundColor: '#f5f5f5' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#4f46e5' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },

  list: { padding: 12, gap: 10, paddingBottom: 120 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  cardIOS: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  cardDesc: { fontSize: 13, color: '#666' },
  cardDept: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  badge2: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  badgeText2: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 2 },

  startBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  startBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  editBtn: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  editBtnText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint: { fontSize: 14, color: '#bbb', textAlign: 'center', paddingHorizontal: 20 },

  // Pending button in header
  pendingBtn: {
    marginRight: 12,
    padding: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  pendingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  acceptBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rejectBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
    paddingBottom: 40,
  },
  modalSheetIOS: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeAdjustRow: { gap: 4 },
  timeInput: { flex: 1 },
  timeHint: { fontSize: 12, color: '#aaa' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
