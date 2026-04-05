import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';

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

const EDITABLE_STATUSES: Array<{ value: Task['status']; label: string }> = [
  { value: 'accepted', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const projectId = id as Id<'projects'>;
  const project = useQuery(api.projects.getProject, { projectId });
  const members = useQuery(api.projects.getProjectMembers, { projectId });
  const tasks = useQuery(api.tasks.getProjectTasks, { projectId });
  const departments = useQuery(api.departments.getDepartments);
  const currentUser = useQuery(api.users.getCurrentUser);

  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const generateInvite = useMutation(api.projects.generateInviteToken);

  // Create task state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState<Id<'users'> | undefined>();
  const [newDept, setNewDept] = useState<Id<'departments'> | undefined>();

  // Edit task state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<Task['status']>('accepted');
  const [editAssignee, setEditAssignee] = useState<Id<'users'> | undefined>();
  const [editDept, setEditDept] = useState<Id<'departments'> | undefined>();

  // Filters
  const [filterDept, setFilterDept] = useState<string | null>(null); // null = all, 'none' = no dept
  const [filterUser, setFilterUser] = useState<Id<'users'> | null>(null);

  // Name lookup map from userId → name
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members ?? []) {
      if (m) map.set(m.userId, m.name);
    }
    return map;
  }, [members]);

  // Dept lookup map
  const deptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments ?? []) {
      map.set(d._id, d.name);
    }
    return map;
  }, [departments]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    return (tasks ?? []).filter((task) => {
      if (filterDept !== null) {
        if (filterDept === 'none' && task.departmentId) return false;
        if (filterDept !== 'none' && task.departmentId !== filterDept) return false;
      }
      if (filterUser !== null && task.assigneeId !== filterUser) return false;
      return true;
    });
  }, [tasks, filterDept, filterUser]);

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditStatus(task.status === 'pending_acceptance' ? 'accepted' : task.status);
    setEditAssignee(task.assigneeId);
    setEditDept(task.departmentId);
  }

  async function handleCreateTask() {
    if (!newTitle.trim()) return;
    try {
      await createTask({
        projectId,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        assigneeId: newAssignee,
        departmentId: newDept,
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewAssignee(undefined);
      setNewDept(undefined);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleSaveEdit() {
    if (!editingTask || !editTitle.trim()) return;
    try {
      await updateTask({
        taskId: editingTask._id,
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        status: editStatus,
        assigneeId: editAssignee,
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

  async function handleInvite() {
    try {
      const token = await generateInvite({ projectId });
      await Share.share({
        message: `Join my project "${project?.name}" on Task Manager!\n\nInvite token: ${token}`,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  if (!project) return null;

  const memberProfiles = members ?? [];
  const deptList = departments ?? [];
  const activeFilterCount = (filterDept !== null ? 1 : 0) + (filterUser !== null ? 1 : 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.projectHeader}>
          <Text style={styles.projectName}>{project.name}</Text>
          {project.description ? <Text style={styles.projectDesc}>{project.description}</Text> : null}
          <Pressable style={styles.inviteBtn} onPress={handleInvite}>
            <Text style={styles.inviteBtnText}>🔗  Share Invite Token</Text>
          </Pressable>
        </View>

        {/* Members */}
        <Text style={styles.sectionTitle}>Members ({memberProfiles.length})</Text>
        {memberProfiles.map((m) =>
          m ? (
            <View key={m._id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{m.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>{m.customRoleLabel ?? m.role}</Text>
              </View>
            </View>
          ) : null,
        )}

        {/* Tasks section */}
        <View style={styles.tasksHeader}>
          <Text style={styles.sectionTitle}>
            Tasks ({filteredTasks.length}{activeFilterCount > 0 ? ' filtered' : ''})
          </Text>
          <Pressable style={styles.addTaskBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addTaskBtnText}>+ Add</Text>
          </Pressable>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          {/* Department filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[styles.filterChip, filterDept === null && styles.filterChipActive]}
              onPress={() => setFilterDept(null)}
            >
              <Text style={[styles.filterChipText, filterDept === null && styles.filterChipTextActive]}>
                All Depts
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, filterDept === 'none' && styles.filterChipActive]}
              onPress={() => setFilterDept(filterDept === 'none' ? null : 'none')}
            >
              <Text style={[styles.filterChipText, filterDept === 'none' && styles.filterChipTextActive]}>
                No Dept
              </Text>
            </Pressable>
            {deptList.map((d) => (
              <Pressable
                key={d._id}
                style={[styles.filterChip, filterDept === d._id && styles.filterChipActive]}
                onPress={() => setFilterDept(filterDept === d._id ? null : d._id)}
              >
                <Text style={[styles.filterChipText, filterDept === d._id && styles.filterChipTextActive]}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* User filter */}
        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              style={[styles.filterChip, filterUser === null && styles.filterChipActive]}
              onPress={() => setFilterUser(null)}
            >
              <Text style={[styles.filterChipText, filterUser === null && styles.filterChipTextActive]}>
                All Users
              </Text>
            </Pressable>
            {memberProfiles.map((m) =>
              m ? (
                <Pressable
                  key={m.userId}
                  style={[styles.filterChip, filterUser === m.userId && styles.filterChipActive]}
                  onPress={() => setFilterUser(filterUser === m.userId ? null : m.userId)}
                >
                  <Text style={[styles.filterChipText, filterUser === m.userId && styles.filterChipTextActive]}>
                    {m.name}
                  </Text>
                </Pressable>
              ) : null,
            )}
          </ScrollView>
        </View>

        {filteredTasks.length === 0 && (
          <Text style={styles.emptyText}>No tasks match the current filters.</Text>
        )}

        {filteredTasks.map((task) => (
          <View key={task._id} style={styles.taskCard}>
            <View style={styles.taskCardHeader}>
              <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[task.status] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[task.status] }]}>
                  {STATUS_LABELS[task.status]}
                </Text>
              </View>
            </View>
            {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
            <View style={styles.taskMeta}>
              {task.assigneeId && (
                <Text style={styles.taskMetaText}>
                  👤 {memberMap.get(task.assigneeId) ?? 'Unknown'}
                </Text>
              )}
              {task.departmentId && (
                <Text style={styles.taskMetaText}>
                  🏢 {deptMap.get(task.departmentId) ?? '—'}
                </Text>
              )}
            </View>
            <View style={styles.taskActions}>
              <Pressable style={styles.editBtn} onPress={() => openEdit(task)}>
                <Text style={styles.editBtnText}>✎  Edit</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(task)}>
                <Text style={styles.deleteBtnText}>✕  Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Create Task Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TextInput style={styles.input} placeholder="Title *" value={newTitle} onChangeText={setNewTitle} />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <Text style={styles.fieldLabel}>Assign to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, !newAssignee && styles.chipActive]}
                    onPress={() => setNewAssignee(undefined)}
                  >
                    <Text style={[styles.chipText, !newAssignee && styles.chipTextActive]}>Unassigned</Text>
                  </Pressable>
                  {memberProfiles.map((m) =>
                    m ? (
                      <Pressable
                        key={m.userId}
                        style={[styles.chip, newAssignee === m.userId && styles.chipActive]}
                        onPress={() => setNewAssignee(m.userId)}
                      >
                        <Text style={[styles.chipText, newAssignee === m.userId && styles.chipTextActive]}>
                          {m.name}
                        </Text>
                      </Pressable>
                    ) : null,
                  )}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, !newDept && styles.chipActive]}
                    onPress={() => setNewDept(undefined)}
                  >
                    <Text style={[styles.chipText, !newDept && styles.chipTextActive]}>None</Text>
                  </Pressable>
                  {deptList.map((d) => (
                    <Pressable
                      key={d._id}
                      style={[styles.chip, newDept === d._id && styles.chipActive]}
                      onPress={() => setNewDept(d._id)}
                    >
                      <Text style={[styles.chipText, newDept === d._id && styles.chipTextActive]}>
                        {d.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={handleCreateTask}>
                  <Text style={styles.confirmBtnText}>Create</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Task Modal */}
      <Modal visible={!!editingTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Edit Task</Text>
              <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Title" />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Description"
                multiline
              />

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {EDITABLE_STATUSES.map((s) => (
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

              <Text style={styles.fieldLabel}>Assign to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, !editAssignee && styles.chipActive]}
                    onPress={() => setEditAssignee(undefined)}
                  >
                    <Text style={[styles.chipText, !editAssignee && styles.chipTextActive]}>Unassigned</Text>
                  </Pressable>
                  {memberProfiles.map((m) =>
                    m ? (
                      <Pressable
                        key={m.userId}
                        style={[styles.chip, editAssignee === m.userId && styles.chipActive]}
                        onPress={() => setEditAssignee(m.userId)}
                      >
                        <Text style={[styles.chipText, editAssignee === m.userId && styles.chipTextActive]}>
                          {m.name}
                        </Text>
                      </Pressable>
                    ) : null,
                  )}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, !editDept && styles.chipActive]}
                    onPress={() => setEditDept(undefined)}
                  >
                    <Text style={[styles.chipText, !editDept && styles.chipTextActive]}>None</Text>
                  </Pressable>
                  {deptList.map((d) => (
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
                <Pressable style={styles.confirmBtn} onPress={handleSaveEdit}>
                  <Text style={styles.confirmBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 10 },
  projectHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  projectName: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  projectDesc: { fontSize: 14, color: '#666' },
  inviteBtn: {
    backgroundColor: '#ede9fe',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  inviteBtnText: { color: '#4f46e5', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginTop: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  memberRole: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
  tasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addTaskBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addTaskBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filtersRow: { marginBottom: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: '#4f46e5' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: '#fff' },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  taskDesc: { fontSize: 13, color: '#888' },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  taskMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  taskMetaText: { fontSize: 12, color: '#888' },
  taskActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  editBtn: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  editBtnText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  emptyText: { color: '#999', fontSize: 13, textAlign: 'center', padding: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: { minHeight: 68, textAlignVertical: 'top' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 4,
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
  confirmBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
