import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Projects I'm a member of (or own)
export const getMyProjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);

    const projects = await Promise.all(
      memberships.map((m) => ctx.db.get(m.projectId)),
    );
    return projects.filter(Boolean);
  },
});

// Admin: get all projects
export const getAllProjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile?.role !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("projects").take(200);
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.get(args.projectId);
  },
});

export const getProjectMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(100);

    const profiles = await Promise.all(
      members.map((m) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", m.userId))
          .unique(),
      ),
    );
    return profiles.filter(Boolean);
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      ownerId: userId,
    });

    // Auto-join as first member
    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      joinedAt: Date.now(),
    });

    return projectId;
  },
});

export const generateInviteToken = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Only project members can generate invite links
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_and_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .unique();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!membership && profile?.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await ctx.db.insert("projectInvites", {
      projectId: args.projectId,
      token,
      createdBy: userId,
    });
    return token;
  },
});

export const joinByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invite = await ctx.db
      .query("projectInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) throw new Error("Invalid invite token");

    // Check not already a member
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_and_userId", (q) =>
        q.eq("projectId", invite.projectId).eq("userId", userId),
      )
      .unique();
    if (existing) return invite.projectId;

    await ctx.db.insert("projectMembers", {
      projectId: invite.projectId,
      userId,
      joinedAt: Date.now(),
    });
    return invite.projectId;
  },
});

export const removeProjectMember = mutation({
  args: {
    projectId: v.id("projects"),
    memberUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (project?.ownerId !== userId && profile?.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_and_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.memberUserId),
      )
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});
