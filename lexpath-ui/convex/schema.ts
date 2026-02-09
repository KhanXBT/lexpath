import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  usageTracking: defineTable({
    ipAddress: v.string(),
    requestCount: v.number(),
    lastRequestAt: v.number(),
  }).index("by_ip", ["ipAddress"]),
});
