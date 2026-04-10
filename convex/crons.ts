import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Runs hourly: stops active timers for users whose auto-stop hour matches
export const checkAutoStop = internalMutation({
  args: { utcHour: v.number() },
  handler: async (ctx, args) => {
    const activeTimers = await ctx.db.query("activeTimers").take(200);
    const now = Date.now();

    for (const timer of activeTimers) {
      const settings = await ctx.db
        .query("userSettings")
        .withIndex("by_userId", (q) => q.eq("userId", timer.userId))
        .unique();

      if (!settings?.autoStopEnabled) continue;
      if (settings.autoStopHour !== args.utcHour) continue;

      await ctx.db.patch(timer.sessionId, { endTime: now });
      await ctx.db.delete(timer._id);
      await ctx.db.patch(timer.taskId, { status: "accepted" });
    }
  },
});

const crons = cronJobs();

// Schedule one cron per UTC hour so each fires exactly once at HH:00 UTC
for (let h = 0; h < 24; h++) {
  crons.cron(
    `auto-stop-hour-${h}`,
    `0 ${h} * * *`,
    internal.crons.checkAutoStop,
    { utcHour: h },
  );
}

export default crons;
