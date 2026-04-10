import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const updateUserSettings = mutation({
  args: {
    autoStopEnabled: v.boolean(),
    autoStopHour: v.number(), // 0-23 UTC
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        autoStopEnabled: args.autoStopEnabled,
        autoStopHour: args.autoStopHour,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        autoStopEnabled: args.autoStopEnabled,
        autoStopHour: args.autoStopHour,
      });
    }
  },
});
