"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const FREE_REQUEST_LIMIT = 5;

type StressTestResult = {
    success: boolean;
    limitExceeded?: boolean;
    remainingRequests: number;
    result?: {
        verdict: string;
        interrogatories: string[];
        contradiction: string;
    };
    error?: string;
    message?: string;
};

type RemainingRequestsResult = {
    remainingRequests: number;
    totalUsed: number;
};

// Prompts for each persona
const PROMPTS: Record<string, string> = {
    judge: `You are "The Honorable Judge Aegis," a senior, highly skeptical judge.
Your job is NOT to help the user. Your job is to INTERROGATE their legal theory, find every logical inconsistency, and expose the "fragility" of their case.

THE INCONSISTENCY ENGINE PROTOCOL:
1. The Contradiction Search: Look for "Statement A" that contradicts "Statement B," even if they are pages apart.
2. The "So What?" Test: Challenge the relevance of their strongest evidence. Ask: "Even if true, how does it meet the legal threshold?"
3. The Precedent Trap: Identify potential counter-precedents or common-law principles that oppose the user's direction.
4. The Ghost Fact Identification: Point out what is MISSING. What evidence *should* be here if the story were true?

Output JSON format: { "verdict": "The Verdict of Vulnerability (1 sentence summary)", "interrogatories": ["Critical Question 1", "Critical Question 2", "Critical Question 3"], "contradiction": "The Hidden Contradiction (specific highlight)" }`,

    counsel: `You are "Silas Vane," a predatory opposing counsel.
Your goal is to win at all costs by exploiting any procedural error, witness bias, or lack of physical evidence.

STRATEGY: EXPLOIT & NEUTRALIZE
1. Character Assassination (Logic-based): Find reasons to doubt the credibility of potential witnesses.
2. Procedural Nitpicking: Look for "Statute of Limitations" issues, jurisdiction flaws, or improper service.
3. Alternative Narratives: Reframe the facts into a story where the *user* is liable.
4. The "Wait and See" Trap: Identify which parts of the case are ripe to be destroyed in discovery.

Output JSON format: { "verdict": "The Counter-Strike Strategy (1 sentence)", "interrogatories": ["Weakest Link Q1", "Weakest Link Q2", "Weakest Link Q3"], "contradiction": "Specific weakness in the timeline or evidence." }`,

    jury: `You are a "Skeptical Jury" (12 ordinary citizens).
You lack legal training but have strong "common sense" and high sensitivity to deception or arrogance.

THE GUT CHECK PROTOCOL:
1. The "Sniff" Test: Does this story *feel* real? Identify parts that sound "too perfect" or "lawyerly."
2. The Relatability Gap: Point out where the language is too technical or cold.
3. The Sympathy Check: Is the user the victim or the villain?
4. The "Wait, I'm Confused" Indicator: Highlight sections that are logically dense.

Output JSON format: { "verdict": "The Gut Verdict (1 sentence emotional reaction)", "interrogatories": ["Confusion Point 1", "Confusion Point 2", "Confusion Point 3"], "contradiction": "The point where you lost trust." }`,

    auditor: `You are "The Corporate Auditor," a ruthless regulatory compliance expert.
Your focus is on fiduciary duty, regulatory arbitrage, and systemic risk.

AUDIT PROTOCOL:
1. Governance Gaps: Identify where board oversight or internal controls are failing.
2. Liability Exposure: Find hidden clauses or actions that trigger massive financial penalties.
3. Fiduciary Breach: Point out where self-interest might be overriding duty to shareholders or the law.
4. Red Flags: Highlight "too good to be true" financial projections or opacity in decision-making.

Output JSON format: { "verdict": "The Risk Assessment (1 sentence level of exposure)", "interrogatories": ["Audit Query 1", "Audit Query 2", "Audit Query 3"], "contradiction": "Compliance mismatch or governance flaw." }`,

    ip: `You are "The IP Guardian," a specialist in Intellectual Property and Patent Law.
Your goal is to protect innovation and identify infringement or theft.

IP DEFENSE PROTOCOL:
1. Prior Art Search: Challenge the novelty of the idea. Has this been done before?
2. Infringement Trap: Identify where the strategy might tread on existing patents or trademarks.
3. Trade Secret Vulnerability: Point out where "secret sauce" is being leaked or improperly protected.
4. Licensing Flaws: Look for gaps in ownership or permission chains.

Output JSON format: { "verdict": "The IP Integrity Score (1 sentence summary)", "interrogatories": ["IP Conflict 1", "IP Conflict 2", "IP Conflict 3"], "contradiction": "Patent clash or trademark overlap." }`,
};

// Main action for stress test - runs on Convex server with Node.js
export const runStressTest = action({
    args: {
        persona: v.union(
            v.literal("judge"),
            v.literal("counsel"),
            v.literal("jury"),
            v.literal("auditor"),
            v.literal("ip")
        ),
        strategy: v.string(),
        evidenceBase64: v.optional(v.string()),
        clientIp: v.optional(v.string()),
    },
    returns: v.object({
        success: v.boolean(),
        limitExceeded: v.optional(v.boolean()),
        remainingRequests: v.number(),
        result: v.optional(v.object({
            verdict: v.string(),
            interrogatories: v.array(v.string()),
            contradiction: v.string(),
        })),
        error: v.optional(v.string()),
        message: v.optional(v.string()),
    }),
    handler: async (ctx, args): Promise<StressTestResult> => {
        const ipAddress = args.clientIp || "unknown";

        // Check current usage
        const usage = await ctx.runQuery(internal.usage.getUsageByIp, {
            ipAddress,
        });

        const currentCount = (usage?.requestCount as number) || 0;

        if (currentCount >= FREE_REQUEST_LIMIT) {
            return {
                success: false,
                limitExceeded: true,
                remainingRequests: 0,
                message: "Free request limit exceeded. Please enter your own API key.",
            };
        }

        // Increment usage before making the API call
        const newCount = await ctx.runMutation(internal.usage.incrementUsage, {
            ipAddress,
        }) as number;

        // Get Gemini API key from environment
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return {
                success: false,
                error: "Server configuration error: Missing API key",
                remainingRequests: FREE_REQUEST_LIMIT - newCount,
            };
        }

        try {
            // Call Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `${PROMPTS[args.persona]}\n\nCASE STRATEGY TO ANALYZE:\n"${args.strategy}"\n\nRespond strictly in JSON.`,
                                    },
                                ],
                            },
                        ],
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Error:", errorText);
                return {
                    success: false,
                    error: "API call failed",
                    remainingRequests: FREE_REQUEST_LIMIT - newCount,
                };
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Parse JSON from response
            const cleanJson = text.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleanJson);

            return {
                success: true,
                result: {
                    verdict: parsed.verdict || "Analysis Inconclusive",
                    interrogatories: parsed.interrogatories || [],
                    contradiction: parsed.contradiction || "No specific contradiction found.",
                },
                remainingRequests: FREE_REQUEST_LIMIT - newCount,
            };
        } catch (error) {
            console.error("Stress test error:", error);
            return {
                success: false,
                error: "Failed to process request",
                remainingRequests: FREE_REQUEST_LIMIT - newCount,
            };
        }
    },
});

// Query to check remaining requests for an IP
export const getRemainingRequests = action({
    args: { clientIp: v.optional(v.string()) },
    returns: v.object({
        remainingRequests: v.number(),
        totalUsed: v.number(),
    }),
    handler: async (ctx, args): Promise<RemainingRequestsResult> => {
        const ipAddress = args.clientIp || "unknown";
        const usage = await ctx.runQuery(internal.usage.getUsageByIp, {
            ipAddress,
        });
        const currentCount = (usage?.requestCount as number) || 0;
        return {
            remainingRequests: Math.max(0, FREE_REQUEST_LIMIT - currentCount),
            totalUsed: currentCount,
        };
    },
});
