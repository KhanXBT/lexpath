import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal query to get usage by IP (V8 runtime)
export const getUsageByIp = internalQuery({
    args: { ipAddress: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("usageTracking")
            .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
            .first();
    },
});

// Internal mutation to increment usage (V8 runtime)
export const incrementUsage = internalMutation({
    args: { ipAddress: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("usageTracking")
            .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                requestCount: existing.requestCount + 1,
                lastRequestAt: Date.now(),
            });
            return existing.requestCount + 1;
        } else {
            await ctx.db.insert("usageTracking", {
                ipAddress: args.ipAddress,
                requestCount: 1,
                lastRequestAt: Date.now(),
            });
            return 1;
        }
    },
});
