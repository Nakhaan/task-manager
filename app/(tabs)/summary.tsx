import { useQuery } from 'convex/react';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/convex/_generated/api';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart(date = new Date()): number {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSeconds}s`;
}

function weekLabel(weekStart: number): string {
  const end = new Date(weekStart + 6 * 24 * 60 * 60 * 1000);
  const start = new Date(weekStart);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

const BAR_COLORS = ['#4f46e5', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#be185d'];

export default function SummaryScreen() {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [view, setView] = useState<'week' | 'total'>('week');

  const weekSummary = useQuery(api.timers.getWeekSummary, { weekStart });
  const totalSummary = useQuery(api.timers.getTimeSummary);

  function prevWeek() {
    setWeekStart((w) => w - 7 * 24 * 60 * 60 * 1000);
  }
  function nextWeek() {
    const next = weekStart + 7 * 24 * 60 * 60 * 1000;
    if (next <= getWeekStart()) setWeekStart(next);
  }

  const isCurrentWeek = weekStart === getWeekStart();
  const days = weekSummary ?? [];
  const weekTotal = days.reduce((a, d) => a + d.totalMs, 0);
  const maxMs = Math.max(...days.map((d) => d.totalMs), 1);

  async function exportToExcel() {
    try {
      const rows: (string | number)[][] = [
        ['Day', 'Date', 'Hours', 'Minutes', 'Total (hh:mm)'],
        ...days.map((d) => {
          const date = new Date(weekStart + d.day * 24 * 60 * 60 * 1000);
          const h = Math.floor(d.totalMs / 3600000);
          const m = Math.floor((d.totalMs % 3600000) / 60000);
          return [
            DAY_FULL[d.day],
            date.toLocaleDateString(),
            h,
            m,
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          ];
        }),
        [
          'Total',
          '',
          Math.floor(weekTotal / 3600000),
          Math.floor((weekTotal % 3600000) / 60000),
          formatDuration(weekTotal),
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Week Summary');

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, `week_summary_${new Date(weekStart).toISOString().slice(0, 10)}.xlsx`);
        return;
      }

      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `week_summary_${new Date(weekStart).toISOString().slice(0, 10)}.xlsx`;
      const uri = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory) + fileName;

      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export Week Summary',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        Alert.alert('Saved', `File saved to: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export failed', err.message);
    }
  }

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={[styles.container, isIOS && styles.containerIOS]}>
      {/* View toggle */}
      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.toggleBtn, view === 'week' && styles.toggleBtnActive]}
          onPress={() => setView('week')}
        >
          <Text style={[styles.toggleText, view === 'week' && styles.toggleTextActive]}>Week</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, view === 'total' && styles.toggleBtnActive]}
          onPress={() => setView('total')}
        >
          <Text style={[styles.toggleText, view === 'total' && styles.toggleTextActive]}>All Time</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {view === 'week' ? (
          <WeekView
            days={days}
            weekStart={weekStart}
            weekTotal={weekTotal}
            maxMs={maxMs}
            weekLabel={weekLabel(weekStart)}
            isCurrentWeek={isCurrentWeek}
            onPrev={prevWeek}
            onNext={nextWeek}
            onExport={exportToExcel}
            isIOS={isIOS}
          />
        ) : (
          <TotalView summary={totalSummary ?? []} isIOS={isIOS} />
        )}
      </ScrollView>
    </View>
  );
}

// ── Week view ────────────────────────────────────────────
type WeekViewProps = {
  days: { day: number; totalMs: number }[];
  weekStart: number;
  weekTotal: number;
  maxMs: number;
  weekLabel: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onExport: () => void;
  isIOS: boolean;
};

function WeekView(p: WeekViewProps) {
  return (
    <>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable style={styles.navBtn} onPress={p.onPrev}>
          <Ionicons name="chevron-back" size={20} color="#4f46e5" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.weekLabel}>{p.weekLabel}</Text>
          {p.isCurrentWeek && <Text style={styles.weekCurrent}>This week</Text>}
        </View>
        <Pressable
          style={[styles.navBtn, p.isCurrentWeek && styles.navBtnDisabled]}
          onPress={p.onNext}
          disabled={p.isCurrentWeek}
        >
          <Ionicons name="chevron-forward" size={20} color={p.isCurrentWeek ? '#ccc' : '#4f46e5'} />
        </Pressable>
      </View>

      {/* Total card */}
      <View style={[p.isIOS ? styles.totalCardIOS : styles.totalCard]}>
        <Text style={styles.totalLabel}>Week Total</Text>
        <Text style={styles.totalValue}>{formatDuration(p.weekTotal)}</Text>
      </View>

      {/* Day bars */}
      {p.days.map((d) => {
        const pct = p.maxMs > 0 ? (d.totalMs / p.maxMs) * 100 : 0;
        const color = BAR_COLORS[d.day % BAR_COLORS.length];
        const date = new Date(p.weekStart + d.day * 24 * 60 * 60 * 1000);
        return (
          <View key={d.day} style={p.isIOS ? styles.dayCardIOS : styles.dayCard}>
            <View style={styles.dayHeader}>
              <View>
                <Text style={styles.dayName}>{DAY_NAMES[d.day]}</Text>
                <Text style={styles.dayDate}>
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={[styles.dayTime, d.totalMs === 0 && { color: '#ccc' }]}>
                {d.totalMs > 0 ? formatDuration(d.totalMs) : '—'}
              </Text>
            </View>
            <View style={styles.barBg}>
              {pct > 0 && (
                <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              )}
            </View>
          </View>
        );
      })}

      {/* Export button */}
      <Pressable style={styles.exportBtn} onPress={p.onExport}>
        <Ionicons name="download-outline" size={18} color="#fff" />
        <Text style={styles.exportBtnText}>Export to Excel</Text>
      </Pressable>
    </>
  );
}

// ── All-time view (original summary) ────────────────────
type TotalViewProps = {
  summary: {
    departmentId: string;
    name: string;
    totalMs: number;
    tasks: { taskId: string; title: string; totalMs: number }[];
  }[];
  isIOS: boolean;
};

function TotalView({ summary, isIOS }: TotalViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = summary.reduce((a, r) => a + r.totalMs, 0);

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No time logged yet.</Text>
        <Text style={styles.emptyHint}>Start a task from the Timer tab.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={isIOS ? styles.totalCardIOS : styles.totalCard}>
        <Text style={styles.totalLabel}>All-Time Total</Text>
        <Text style={styles.totalValue}>{formatDuration(total)}</Text>
      </View>
      {summary.map((row, i) => {
        const pct = total > 0 ? (row.totalMs / total) * 100 : 0;
        const color = BAR_COLORS[i % BAR_COLORS.length];
        const isExp = expanded.has(row.departmentId);
        return (
          <View key={row.departmentId} style={isIOS ? styles.dayCardIOS : styles.dayCard}>
            <Pressable style={styles.deptHeader} onPress={() => toggle(row.departmentId)}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.deptName}>{row.name}</Text>
              <Text style={styles.deptTime}>{formatDuration(row.totalMs)}</Text>
              <Text style={[styles.chevron, isExp && styles.chevronOpen]}>›</Text>
            </Pressable>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={styles.pctLabel}>{pct.toFixed(1)}%</Text>
            {isExp && (
              <View style={styles.taskList}>
                {row.tasks.map((task) => {
                  const tPct = row.totalMs > 0 ? (task.totalMs / row.totalMs) * 100 : 0;
                  return (
                    <View key={task.taskId} style={styles.taskRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                        <View style={styles.taskBarBg}>
                          <View
                            style={[
                              styles.taskBarFill,
                              { width: `${tPct}%` as any, backgroundColor: color + '88' },
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  containerIOS: { backgroundColor: 'rgba(245,245,245,0.85)' },
  viewToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#999' },
  toggleTextActive: { color: '#1a1a2e' },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },

  // Week navigation
  weekNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  navBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
  },
  navBtnDisabled: { backgroundColor: '#f0f0f0' },
  weekLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  weekCurrent: { fontSize: 12, color: '#4f46e5', marginTop: 2 },

  // Total card
  totalCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  totalCardIOS: {
    backgroundColor: 'rgba(79,70,229,0.85)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  totalLabel: { color: '#c7d2fe', fontSize: 14, fontWeight: '500' },
  totalValue: { color: '#fff', fontSize: 36, fontWeight: '700', marginTop: 4 },

  // Day/dept cards
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dayCardIOS: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  dayDate: { fontSize: 12, color: '#888', marginTop: 1 },
  dayTime: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },

  barBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  // Dept (all-time view)
  deptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  deptName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  deptTime: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  chevron: { fontSize: 20, color: '#aaa', marginLeft: 4 },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: '#4f46e5' },
  pctLabel: { fontSize: 12, color: '#999' },
  taskList: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    gap: 8,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskTitle: { fontSize: 13, fontWeight: '500', color: '#333' },
  taskBarBg: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  taskBarFill: { height: 4, borderRadius: 2 },
  taskTime: { fontSize: 13, fontWeight: '600', color: '#555', minWidth: 50, textAlign: 'right' },

  // Export
  exportBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
  emptyHint: { fontSize: 14, color: '#bbb' },
});
