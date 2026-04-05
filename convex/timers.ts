import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Get the currently running timer — includes startTime from the session
export const getActiveTimer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const timer = await ctx.db
      .query("activeTimers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!timer) return null;

    const task = await ctx.db.get(timer.taskId);
    const session = await ctx.db.get(timer.sessionId);

    // Sum all previous completed sessions for this task (exclude current open one)
    const allSessions = await ctx.db
      .query("timeSessions")
      .withIndex("by_userId_and_taskId", (q) =>
        q.eq("userId", userId).eq("taskId", timer.taskId),
      )
      .take(200);
    const previousMs = allSessions.reduce((acc, s) => {
      if (s._id === timer.sessionId || !s.endTime) return acc;
      return acc + (s.endTime - s.startTime);
    }, 0);

    return { ...timer, task, startTime: session?.startTime ?? Date.now(), previousMs };
  },
});

// Start (or resume) timing a task. Pauses any currently running task.
export const startTimer = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    const existing = await ctx.db
      .query("activeTimers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      if (existing.taskId === args.taskId) return; // already running this task
      await ctx.db.patch(existing.sessionId, { endTime: now });
      await ctx.db.delete(existing._id);
      // Revert paused task to accepted
      await ctx.db.patch(existing.taskId, { status: "accepted" });
    }

    await ctx.db.patch(args.taskId, { status: "in_progress" });

    const sessionId = await ctx.db.insert("timeSessions", {
      taskId: args.taskId,
      userId,
      startTime: now,
    });

    await ctx.db.insert("activeTimers", {
      userId,
      taskId: args.taskId,
      sessionId,
    });
  },
});

// Pause the current running timer
export const pauseTimer = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    const existing = await ctx.db
      .query("activeTimers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) return;

    await ctx.db.patch(existing.sessionId, { endTime: now });
    await ctx.db.delete(existing._id);
    await ctx.db.patch(existing.taskId, { status: "accepted" });
  },
});

// My accepted + in_progress tasks enriched with total time spent
export const getMyTasksWithTime = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const accepted = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "accepted"),
      )
      .take(50);

    const inProgress = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "in_progress"),
      )
      .take(50);

    const tasks = [...inProgress, ...accepted];
    const now = Date.now();

    return Promise.all(
      tasks.map(async (task) => {
        const sessions = await ctx.db
          .query("timeSessions")
          .withIndex("by_userId_and_taskId", (q) =>
            q.eq("userId", userId).eq("taskId", task._id),
          )
          .take(200);
        const totalMs = sessions.reduce(
          (acc, s) => acc + ((s.endTime ?? now) - s.startTime),
          0,
        );
        return { ...task, totalMs };
      }),
    );
  },
});

// Summary: total time per department, with task breakdown
export const getTimeSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sessions = await ctx.db
      .query("timeSessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(500);

    const now = Date.now();
    const byTask: Partial<Record<Id<"tasks">, number>> = {};

    for (const s of sessions) {
      const end = s.endTime ?? now;
      byTask[s.taskId] = (byTask[s.taskId] ?? 0) + (end - s.startTime);
    }

    type DeptEntry = {
      name: string;
      totalMs: number;
      tasks: Array<{ taskId: string; title: string; totalMs: number }>;
    };
    const byDepartment: Record<string, DeptEntry> = {};
    const noDeptTasks: Array<{ taskId: string; title: string; totalMs: number }> = [];

    const taskIds = Object.keys(byTask) as Array<Id<"tasks">>;

    for (const taskId of taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      const duration = byTask[taskId] ?? 0;
      const taskEntry = { taskId, title: task.title, totalMs: duration };

      if (task.departmentId) {
        const dept = await ctx.db.get(task.departmentId);
        if (dept) {
          const key = dept._id;
          if (!byDepartment[key]) {
            byDepartment[key] = { name: dept.name, totalMs: 0, tasks: [] };
          }
          byDepartment[key].totalMs += duration;
          byDepartment[key].tasks.push(taskEntry);
        } else {
          noDeptTasks.push(taskEntry);
        }
      } else {
        noDeptTasks.push(taskEntry);
      }
    }

    const result = Object.entries(byDepartment).map(([id, val]) => ({
      departmentId: id,
      name: val.name,
      totalMs: val.totalMs,
      tasks: val.tasks,
    }));

    const noDeptTotal = noDeptTasks.reduce((a, t) => a + t.totalMs, 0);
    if (noDeptTotal > 0) {
      result.push({
        departmentId: "none",
        name: "No Department",
        totalMs: noDeptTotal,
        tasks: noDeptTasks,
      });
    }

    return result;
  },
});
