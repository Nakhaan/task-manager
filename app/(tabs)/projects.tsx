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

export default function ProjectsScreen() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const myProjects = useQuery(api.projects.getMyProjects);
  const allProjects = useQuery(
    currentUser?.role === 'admin' ? api.projects.getAllProjects : api.projects.getMyProjects,
  );

  const createProject = useMutation(api.projects.createProject);
  const joinByToken = useMutation(api.projects.joinByToken);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joinToken, setJoinToken] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const id = await createProject({ name: newName.trim(), description: newDesc.trim() || undefined });
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      router.push(`/project/${id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleJoin() {
    if (!joinToken.trim()) return;
    try {
      const projectId = await joinByToken({ token: joinToken.trim() });
      setShowJoinModal(false);
      setJoinToken('');
      router.push(`/project/${projectId}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const projects = allProjects ?? [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.topRow}>
          <Text style={styles.sectionTitle}>Projects</Text>
          <View style={styles.topActions}>
            <Pressable style={styles.joinBtn} onPress={() => setShowJoinModal(true)}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
            <Pressable style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.createBtnText}>+ New</Text>
            </Pressable>
          </View>
        </View>

        {projects.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No projects yet.</Text>
            <Text style={styles.emptyHint}>Create a project or join with an invite link.</Text>
          </View>
        )}

        {projects.map((project) => project && (
          <Pressable
            key={project._id}
            style={styles.card}
            onPress={() => router.push(`/project/${project._id}`)}
          >
            <Text style={styles.cardTitle}>{project.name}</Text>
            {project.description ? (
              <Text style={styles.cardDesc}>{project.description}</Text>
            ) : null}
            <Text style={styles.cardArrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Create Project Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.input}
              placeholder="Project name"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleCreate}>
                <Text style={styles.confirmBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join by Token Modal */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Join a Project</Text>
            <Text style={styles.modalHint}>Enter the invite token shared with you.</Text>
            <TextInput
              style={styles.input}
              placeholder="Invite token"
              value={joinToken}
              onChangeText={setJoinToken}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowJoinModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleJoin}>
                <Text style={styles.confirmBtnText}>Join</Text>
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
  list: { padding: 16, gap: 12 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  topActions: { flexDirection: 'row', gap: 8 },
  joinBtn: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinBtnText: { color: '#4f46e5', fontSize: 14, fontWeight: '600' },
  createBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  cardDesc: { fontSize: 13, color: '#888', flex: 1 },
  cardArrow: { fontSize: 24, color: '#ccc' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint: { fontSize: 14, color: '#bbb', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  modalHint: { fontSize: 14, color: '#888' },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
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
