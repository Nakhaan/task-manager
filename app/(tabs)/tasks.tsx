import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Doc } from '@/convex/_generated/dataModel';

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

type Filter = 'all' | 'active' | 'done';

export default function TasksScreen() {
  const router = useRouter();
  const myAllTasks = useQuery(api.tasks.getMyAllTasks);
  const departments = useQuery(api.departments.getDepartments);

  const startTimer = useMutation(api.timers.startTimer);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const [filter, setFilter] = useState<Filter>('active');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<Task['status']>('accepted');
  const [editDept, setEditDept] = useState<Id<'departments'> | undefined>();

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditStatus(task.status === 'in_progress' ? 'in_progress' : task.status);
    setEditDept(task.departmentId);
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
      router.navigate('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const allTasks = myAllTasks ?? [];
  const filtered = allTasks.filter((t) => {
    if (filter === 'active') return t.status !== 'completed';
    if (filter === 'done') return t.status === 'completed';
    return true;
  });

  const editableStatuses: Array<{ value: Task['status']; label: string }> = [
    { value: 'accepted', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Done' },
  ];

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        {(['all', 'active', 'done'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'done' ? 'No completed tasks.' : 'No active tasks.'}
            </Text>
            {filter === 'active' && (
              <Text style={styles.emptyHint}>Accept tasks from the Pending tab.</Text>
            )}
          </View>
        )}

        {filtered.map((task) => (
          <View key={task._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[task.status] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[task.status] }]}>
                  {STATUS_LABELS[task.status]}
                </Text>
              </View>
            </View>
            {task.description ? (
              <Text style={styles.cardDesc}>{task.description}</Text>
            ) : null}
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

      {/* Edit modal */}
      <Modal visible={!!editingTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Task</Text>

            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description (optional)"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.chipRow}>
              {editableStatuses.map((s) => (
                <Pressable
                  key={s.value}
                  style={[styles.chip, editStatus === s.value && styles.chipActive]}
                  onPress={() => setEditStatus(s.value)}
                >
                  <Text style={[styles.chipText, editStatus === s.value && styles.chipTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !editDept && styles.chipActive]}
                  onPress={() => setEditDept(undefined)}
                >
                  <Text style={[styles.chipText, !editDept && styles.chipTextActive]}>None</Text>
                </Pressable>
                {(departments ?? []).map((d) => (
                  <Pressable
                    key={d._id}
                    style={[styles.chip, editDept === d._id && styles.chipActive]}
                    onPress={() => setEditDept(d._id)}
                  >
                    <Text style={[styles.chipText, editDept === d._id && styles.chipTextActive]}>
                      {d.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditingTask(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: 0,
    backgroundColor: '#f5f5f5',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#4f46e5' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: '#fff' },
  list: { padding: 12, gap: 10, paddingTop: 12 },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  cardDesc: { fontSize: 13, color: '#666' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
  emptyHint: { fontSize: 14, color: '#bbb' },
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
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#4f46e5', fontWeight: '700' },
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
