import { useQuery } from 'convex/react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/convex/_generated/api';

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const COLORS = ['#4f46e5', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#be185d'];

export default function SummaryScreen() {
  const summary = useQuery(api.timers.getTimeSummary);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rows = summary ?? [];
  const total = rows.reduce((acc, r) => acc + r.totalMs, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Time Summary</Text>
        <Text style={styles.subtitle}>Time logged by department</Text>

        {total === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No time logged yet.</Text>
            <Text style={styles.emptyHint}>Start a task from the Timer tab.</Text>
          </View>
        )}

        {total > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Time</Text>
            <Text style={styles.totalValue}>{formatDuration(total)}</Text>
          </View>
        )}

        {rows.map((row, i) => {
          const pct = total > 0 ? (row.totalMs / total) * 100 : 0;
          const color = COLORS[i % COLORS.length];
          const isExpanded = expanded.has(row.departmentId);

          return (
            <View key={row.departmentId} style={styles.card}>
              {/* Accordion header */}
              <Pressable style={styles.cardHeader} onPress={() => toggle(row.departmentId)}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.deptName}>{row.name}</Text>
                <Text style={styles.deptTime}>{formatDuration(row.totalMs)}</Text>
                <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
              </Pressable>

              {/* Progress bar */}
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
              <Text style={styles.pctLabel}>{pct.toFixed(1)}% of total</Text>

              {/* Accordion body — task list */}
              {isExpanded && (
                <View style={styles.taskList}>
                  {row.tasks.length === 0 && (
                    <Text style={styles.noTasks}>No tasks</Text>
                  )}
                  {row.tasks.map((task) => {
                    const taskPct = row.totalMs > 0 ? (task.totalMs / row.totalMs) * 100 : 0;
                    return (
                      <View key={task.taskId} style={styles.taskRow}>
                        <View style={styles.taskRowLeft}>
                          <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                          <View style={styles.taskBarBg}>
                            <View
                              style={[
                                styles.taskBarFill,
                                { width: `${taskPct}%` as any, backgroundColor: color + '88' },
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={styles.taskTime}>{formatDuration(task.totalMs)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 4 },
  totalCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: { color: '#c7d2fe', fontSize: 14, fontWeight: '500' },
  totalValue: { color: '#fff', fontSize: 36, fontWeight: '700', marginTop: 4 },
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
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  deptName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  deptTime: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  chevron: {
    fontSize: 20,
    color: '#aaa',
    marginLeft: 4,
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: '#4f46e5',
  },
  barBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  pctLabel: { fontSize: 12, color: '#999' },
  // Task list inside accordion
  taskList: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    gap: 8,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskRowLeft: { flex: 1, gap: 4 },
  taskTitle: { fontSize: 13, fontWeight: '500', color: '#333' },
  taskBarBg: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  taskBarFill: { height: 4, borderRadius: 2 },
  taskTime: { fontSize: 13, fontWeight: '600', color: '#555', minWidth: 50, textAlign: 'right' },
  noTasks: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint: { fontSize: 14, color: '#bbb' },
});
