import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Extended user profiles (role, display name)
  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    customRoleLabel: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  // Departments — only admin can create
  departments: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
  }),

  // Projects
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
  }).index("by_ownerId", ["ownerId"]),

  // Project membership
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_userId", ["projectId", "userId"]),

  // Invite tokens for projects
  projectInvites: defineTable({
    projectId: v.id("projects"),
    token: v.string(),
    createdBy: v.id("users"),
  }).index("by_token", ["token"]),

  // Tasks
  tasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("pending_acceptance"),
      v.literal("accepted"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
    assigneeId: v.optional(v.id("users")),
    creatorId: v.id("users"),
    departmentId: v.optional(v.id("departments")),
  })
    .index("by_projectId", ["projectId"])
    .index("by_assigneeId", ["assigneeId"])
    .index("by_assigneeId_and_status", ["assigneeId", "status"]),

  // Individual time sessions (each start/stop)
  timeSessions: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    // Manual time entries (positive or negative adjustment)
    isManual: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_taskId", ["taskId"])
    .index("by_userId_and_taskId", ["userId", "taskId"]),

  // One active timer per user (replaced on switch)
  activeTimers: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    sessionId: v.id("timeSessions"),
  }).index("by_userId", ["userId"]),

  // Per-user preferences & settings
  userSettings: defineTable({
    userId: v.id("users"),
    autoStopEnabled: v.boolean(),
    autoStopHour: v.number(), // 0–23 (UTC hour to stop the timer)
  }).index("by_userId", ["userId"]),
});
