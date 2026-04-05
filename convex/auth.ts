import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { DataModel } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx: MutationCtx, args) {
      const { userId, existingUserId } = args;
      // Only create profile for new users
      if (existingUserId) return;

      const identity = await ctx.auth.getUserIdentity();
      const user = await ctx.db.get(userId);
      if (!user) return;

      const existingProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      if (!existingProfile) {
        // Check if this is the very first user — make them admin
        const anyProfile = await ctx.db.query("userProfiles").take(1);
        const role = anyProfile.length === 0 ? "admin" : "member";

        await ctx.db.insert("userProfiles", {
          userId,
          name: user.name ?? (user.email?.split("@")[0] ?? "User"),
          email: user.email ?? "",
          role,
        });
      }
    },
  },
});
