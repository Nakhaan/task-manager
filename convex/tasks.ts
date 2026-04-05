import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getProjectTasks = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(200);

    return tasks;
  },
});

// Tasks assigned to me that I've accepted
export const getMyTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const accepted = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "accepted"),
      )
      .take(100);

    const inProgress = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "in_progress"),
      )
      .take(100);

    return [...inProgress, ...accepted];
  },
});

// Tasks assigned to me awaiting acceptance
export const getPendingTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "pending_acceptance"),
      )
      .take(100);
  },
});

export const getTaskById = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.get(args.taskId);
  },
});

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Must be project member
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_and_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new Error("Not a project member");

    const status =
      args.assigneeId && args.assigneeId !== userId
        ? "pending_acceptance"
        : "accepted";

    return await ctx.db.insert("tasks", {
      projectId: args.projectId,
      title: args.title,
      description: args.description,
      status,
      assigneeId: args.assigneeId,
      creatorId: userId,
      departmentId: args.departmentId,
    });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending_acceptance"),
        v.literal("accepted"),
        v.literal("in_progress"),
        v.literal("completed"),
      ),
    ),
    assigneeId: v.optional(v.id("users")),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const { taskId, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.assigneeId !== undefined) patch.assigneeId = updates.assigneeId;
    if (updates.departmentId !== undefined)
      patch.departmentId = updates.departmentId;

    await ctx.db.patch(taskId, patch);
  },
});

export const getMyAllTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const accepted = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "accepted"),
      )
      .take(100);

    const inProgress = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "in_progress"),
      )
      .take(100);

    const completed = await ctx.db
      .query("tasks")
      .withIndex("by_assigneeId_and_status", (q) =>
        q.eq("assigneeId", userId).eq("status", "completed"),
      )
      .take(100);

    return [...inProgress, ...accepted, ...completed];
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const project = await ctx.db.get(task.projectId);

    const isAdmin = profile?.role === "admin";
    const isOwner = project?.ownerId === userId;
    const isCreator = task.creatorId === userId;

    if (!isAdmin && !isOwner && !isCreator) throw new Error("Unauthorized");

    await ctx.db.delete(args.taskId);
  },
});

export const acceptTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.assigneeId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(args.taskId, { status: "accepted" });
  },
});

export const rejectTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.assigneeId !== userId) throw new Error("Unauthorized");

    // Unassign and set back to accepted (creator can reassign)
    await ctx.db.patch(args.taskId, {
      status: "accepted",
      assigneeId: task.creatorId,
    });
  },
});
