import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export default function AdminDepartmentsScreen() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const departments = useQuery(api.departments.getDepartments);
  const createDepartment = useMutation(api.departments.createDepartment);
  const deleteDepartment = useMutation(api.departments.deleteDepartment);

  const [newName, setNewName] = useState('');

  if (currentUser?.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Text style={styles.unauthorized}>Unauthorized</Text>
      </View>
    );
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createDepartment({ name: newName.trim() });
      setNewName('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleDelete(id: Id<'departments'>, name: string) {
    Alert.alert('Delete Department', `Delete "${name}"? Tasks using this department won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDepartment({ departmentId: id });
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>Departments</Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New department name"
            value={newName}
            onChangeText={setNewName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.addBtn} onPress={handleCreate}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {(departments ?? []).length === 0 && (
          <Text style={styles.emptyText}>No departments yet.</Text>
        )}

        {(departments ?? []).map((dept) => (
          <View key={dept._id} style={styles.card}>
            <Text style={styles.deptName}>{dept.name}</Text>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => handleDelete(dept._id, dept.name)}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorized: { fontSize: 18, color: '#dc2626' },
  list: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
  deptName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center', paddingTop: 20 },
});
