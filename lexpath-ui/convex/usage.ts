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

const REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes in milliseconds

// Internal mutation to increment usage (V8 runtime)
export const incrementUsage = internalMutation({
    args: { ipAddress: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("usageTracking")
            .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
            .first();

        const now = Date.now();

        if (existing) {
            const timeSinceLastRequest = now - existing.lastRequestAt;
            const shouldReset = timeSinceLastRequest >= REFRESH_INTERVAL_MS;

            const newCount = shouldReset ? 1 : existing.requestCount + 1;

            await ctx.db.patch(existing._id, {
                requestCount: newCount,
                lastRequestAt: now,
            });
            return newCount;
        } else {
            await ctx.db.insert("usageTracking", {
                ipAddress: args.ipAddress,
                requestCount: 1,
                lastRequestAt: now,
            });
            return 1;
        }
    },
});

// Mutation to reset all usage (for testing/admin)
import { mutation } from "./_generated/server";

export const resetAllUsage = mutation({
    args: {},
    handler: async (ctx) => {
        const allUsage = await ctx.db.query("usageTracking").collect();
        for (const usage of allUsage) {
            await ctx.db.delete(usage._id);
        }
        return { deleted: allUsage.length };
    },
});
