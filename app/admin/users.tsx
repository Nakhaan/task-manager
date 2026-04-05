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

export default function AdminUsersScreen() {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const allUsers = useQuery(api.users.getAllUsers);
  const updateRole = useMutation(api.users.updateUserRole);

  const [editing, setEditing] = useState<Doc<'userProfiles'> | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [customLabel, setCustomLabel] = useState('');

  if (currentUser?.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Text style={styles.unauthorized}>Unauthorized</Text>
      </View>
    );
  }

  async function handleSave() {
    if (!editing) return;
    try {
      await updateRole({
        targetUserId: editing._id,
        role: newRole,
        customRoleLabel: customLabel.trim() || undefined,
      });
      setEditing(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>
          {(allUsers ?? []).length} users registered
        </Text>

        {(allUsers ?? []).map((user) => (
          <View key={user._id} style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={[styles.badge, user.role === 'admin' ? styles.adminBadge : styles.memberBadge]}>
                  <Text style={[styles.badgeText, user.role === 'admin' ? styles.adminBadgeText : styles.memberBadgeText]}>
                    {user.customRoleLabel ?? user.role}
                  </Text>
                </View>
              </View>
            </View>
            {user._id !== currentUser?._id && (
              <Pressable
                style={styles.editBtn}
                onPress={() => {
                  setEditing(user);
                  setNewRole(user.role);
                  setCustomLabel(user.customRoleLabel ?? '');
                }}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Edit role modal */}
      <Modal visible={!!editing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Role — {editing?.name}</Text>

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {(['admin', 'member'] as const).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, newRole === r && styles.roleBtnActive]}
                  onPress={() => setNewRole(r)}
                >
                  <Text style={[styles.roleBtnText, newRole === r && styles.roleBtnTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {newRole === 'member' && (
              <>
                <Text style={styles.fieldLabel}>Custom role label (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Finance Manager, Designer…"
                  value={customLabel}
                  onChangeText={setCustomLabel}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorized: { fontSize: 18, color: '#dc2626' },
  list: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  userEmail: { fontSize: 12, color: '#888' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  adminBadge: { backgroundColor: '#ede9fe' },
  memberBadge: { backgroundColor: '#f0fdf4' },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  adminBadgeText: { color: '#7c3aed' },
  memberBadgeText: { color: '#059669' },
  editBtn: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  editBtnText: { color: '#444', fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#666' },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  roleBtnActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  roleBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
  roleBtnTextActive: { color: '#4f46e5', fontWeight: '700' },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
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
