import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GoogleGenerativeAI } from '@google/generative-ai'

// Environment variables (for user-provided keys only)
const QWEN_API_KEY = import.meta.env.VITE_QWEN_API_KEY || ''
const QWEN_API_ENDPOINT = import.meta.env.VITE_QWEN_API_ENDPOINT || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

// Persona prompts for local calls
const PROMPTS = {
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
  3. Alternative Narratives: Refram the facts into a story where the *user* is liable.
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
  
  Output JSON format: { "verdict": "The IP Integrity Score (1 sentence summary)", "interrogatories": ["IP Conflict 1", "IP Conflict 2", "IP Conflict 3"], "contradiction": "Patent clash or trademark overlap." }`
}

export type ApiConfig = {
    geminiKey?: string;
    qwenKey?: string;
    hfKey?: string;
}

export type AnalysisResult = {
    verdict: string;
    interrogatories: string[];
    contradiction: string;
    qwenCritique?: string;
    saulCritique?: string;
    bestAnswer?: string;
    finalVerdict?: string;
}

export type ConvexStressTestResult = {
    success: boolean;
    limitExceeded?: boolean;
    remainingRequests: number;
    result?: AnalysisResult;
    error?: string;
    message?: string;
}

const SAUL_API_ENDPOINT = "https://api-inference.huggingface.co/models/Equall/Saul-7B-Instruct-v1";

// Get client IP using a free service
async function getClientIp(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

// Hook to use the Convex stress test action
export function useConvexStressTest() {
    const stressTestAction = useAction(api.stressTest.runStressTest);
    const getRemainingAction = useAction(api.stressTest.getRemainingRequests);

    const runViaConvex = async (
        persona: 'judge' | 'counsel' | 'jury' | 'auditor' | 'ip',
        strategy: string,
        evidenceBase64?: string
    ): Promise<ConvexStressTestResult> => {
        const clientIp = await getClientIp();
        return await stressTestAction({
            persona,
            strategy,
            evidenceBase64,
            clientIp,
        });
    };

    const checkRemaining = async (): Promise<{ remainingRequests: number; totalUsed: number }> => {
        const clientIp = await getClientIp();
        return await getRemainingAction({ clientIp });
    };

    return { runViaConvex, checkRemaining };
}

// Direct API call for users with their own key
export async function runStressTestDirect(
    persona: 'judge' | 'counsel' | 'jury' | 'auditor' | 'ip',
    strategy: string,
    evidenceBase64: string | undefined,
    config: ApiConfig
): Promise<AnalysisResult> {
    const activeGeminiKey = config.geminiKey;
    const activeQwenKey = config.qwenKey || QWEN_API_KEY;
    const activeHfKey = config.hfKey;

    if (!activeGeminiKey) {
        throw new Error("No API key provided");
    }

    try {
        const dynamicGenAI = new GoogleGenerativeAI(activeGeminiKey);
        const model = dynamicGenAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const parts: any[] = [
            { text: `${PROMPTS[persona]}\n\nCASE STRATEGY TO ANALYZE:\n"${strategy}"\n\nRespond strictly in JSON.` }
        ];

        if (evidenceBase64) {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: evidenceBase64
                }
            });
            parts[0].text += "\n\n[VISUAL EVIDENCE ATTACHED: Analyze this image for contradictions against the strategy.]";
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        const cleanJson = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        // Optional: Qwen critique
        let qwenCritique = undefined;
        if (activeQwenKey && !activeQwenKey.includes('your_qwen_api_key')) {
            qwenCritique = await runQwenCritique(data, strategy, activeQwenKey);
        }

        // Optional: Saul critique
        let saulCritique = undefined;
        if (activeHfKey) {
            saulCritique = await runSaulCritique(strategy, activeHfKey);
        }

        // Gemini Final Synthesis - consults all inputs
        const { bestAnswer, finalVerdict } = await runGeminiFinalSynthesis(
            model,
            strategy,
            data,
            qwenCritique,
            saulCritique
        );

        return {
            verdict: data.verdict || "Analysis Inconclusive",
            interrogatories: data.interrogatories || [],
            contradiction: data.contradiction || "No specific contradiction found.",
            qwenCritique,
            saulCritique,
            bestAnswer,
            finalVerdict
        };
    } catch (error) {
        console.error("AI Error:", error);
        return {
            verdict: "API Error: Could not complete analysis.",
            interrogatories: ["Check API Keys", "Check Internet Connection"],
            contradiction: "System Failure"
        };
    }
}

// Qwen 3 Integration
async function runQwenCritique(geminiData: any, strategy: string, apiKey: string): Promise<string> {
    try {
        const response = await fetch(QWEN_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "qwen-max",
                messages: [
                    { role: "system", content: "You are a neutral 'Devil's Advocate'. Review the ANALYSIS provided by another AI. Is it fair? Does it miss any 'Blind Spots'? Provide a 1-sentence critique." },
                    { role: "user", content: `Original Strategy: "${strategy}"\n\nAI Analysis: ${JSON.stringify(geminiData)}` }
                ]
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Qwen Critique Unavailable.";
    } catch (e) {
        return "Qwen 3 Offline/Error.";
    }
}

// Saul 7B Integration
async function runSaulCritique(strategy: string, apiKey: string): Promise<string> {
    try {
        const response = await fetch(SAUL_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: `[INST] You are a Legal Scholar trained on US Case Law. Provide 1 relevant legal precedent or case citation that either supports or refutes this strategy: "${strategy}" [/INST]`,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.1,
                    return_full_text: false
                }
            })
        });

        const result = await response.json();
        return result[0]?.generated_text || "Saul 7B Citation Unavailable.";
    } catch (e) {
        console.error("Saul Error:", e);
        return "Saul 7B Offline/Error.";
    }
}

// Gemini Final Synthesis - Consults all AI inputs and gives final answer + verdict
async function runGeminiFinalSynthesis(
    model: any,
    strategy: string,
    initialAnalysis: any,
    qwenCritique?: string,
    saulCritique?: string
): Promise<{ bestAnswer: string; finalVerdict: string }> {
    try {
        const synthesisPrompt = `You are the SUPREME LEGAL ANALYST "GEMINI JUDGE." You have consulted with multiple AI legal experts and must now synthesize their insights into a FINAL, AUTHORITATIVE response.

YOUR ROLE:
1. Review all inputs from your expert consultants
2. Synthesize the BEST possible legal answer/strategy recommendation
3. Deliver a FINAL VERDICT that weighs all perspectives

EXPERT CONSULTANTS' INPUTS:

### INITIAL ANALYSIS (Primary Adversarial Assessment):
- Vulnerability: ${initialAnalysis.verdict || "Not available"}
- Key Questions: ${JSON.stringify(initialAnalysis.interrogatories || [])}
- Contradiction Found: ${initialAnalysis.contradiction || "None"}

### QWEN 3 CRITIQUE (Devil's Advocate):
${qwenCritique || "Not consulted"}

### SAUL 7B LEGAL SCHOLAR (Case Law Expert):
${saulCritique || "Not consulted"}

### ORIGINAL STRATEGY TO ANALYZE:
"${strategy}"

---

Based on ALL the above expert inputs AND your own advanced legal reasoning, provide:

1. **BEST ANSWER**: A synthesized, actionable legal strategy recommendation that addresses ALL identified vulnerabilities. This should be 2-3 sentences of clear, practical advice.

2. **FINAL VERDICT**: Your authoritative conclusion on the viability of this legal strategy. Rate it as: STRONG, MODERATE, WEAK, or CRITICAL RISK. Explain in 1 sentence.

Respond in JSON format:
{
  "bestAnswer": "Your synthesized strategy recommendation here...",
  "finalVerdict": "[RATING] Your final judgment explanation..."
}`;

        const result = await model.generateContent([{ text: synthesisPrompt }]);
        const response = await result.response;
        const text = response.text();

        const cleanJson = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        return {
            bestAnswer: data.bestAnswer || "Unable to synthesize recommendation.",
            finalVerdict: data.finalVerdict || "INCONCLUSIVE: Insufficient data for verdict."
        };
    } catch (e) {
        console.error("Synthesis Error:", e);
        return {
            bestAnswer: "Synthesis unavailable. Review individual AI critiques above.",
            finalVerdict: "INCONCLUSIVE: Synthesis failed. Consider individual expert opinions."
        };
    }
}

// Fallback Simulation
export function simulateResponse(persona: string): Promise<AnalysisResult> {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (persona === 'judge') {
                resolve({
                    verdict: "SIMULATION (Judge): The reliance on 'implied consent' fails strictly against the written denial.",
                    interrogatories: ["Where is the physical record?", "Does the email constitute revocation?", "Why prioritize hearsay?"],
                    contradiction: "Timeline shows cessation of communication despite claims of 'good faith'.",
                    qwenCritique: "Qwen 3 (Simulated): The Judge's point on written denial is legally sound. The emotional argument is weak.",
                    saulCritique: "Saul 7B (Simulated): Cited Case: *Smith v. Jones (2019)* - Written revocation supersedes implied logic in contract disputes.",
                    bestAnswer: "Focus on establishing explicit documented consent. Gather all written communications, timestamps, and witness statements. The emotional narrative is weaker than concrete evidence of the consent timeline.",
                    finalVerdict: "WEAK: Strategy relies too heavily on implied consent without documented evidence. Need to pivot to explicit consent documentation or risk dismissal."
                })
            } else if (persona === 'counsel') {
                resolve({
                    verdict: "SIMULATION (Counsel): Move to strike witness testimony as inadmissible hearsay.",
                    interrogatories: ["Produce timestamped logs.", "Medical substantiation for distress?", "Why was evidence withheld?"],
                    contradiction: "Financial ruin claimed, but discretionary spending increased by 20%.",
                    qwenCritique: "Qwen 3 (Simulated): Counsel is aggressive but the hearsay objection is valid procedural strategy.",
                    saulCritique: "Saul 7B (Simulated): Cited Rule: Federal Rules of Evidence 802 - Hearsay Rule exceptions do not apply to uncorroborated diary entries.",
                    bestAnswer: "Pre-empt the hearsay objection by securing corroborating witnesses BEFORE trial. Address the financial inconsistency by preparing a detailed timeline showing the 20% increase was necessary survival spending, not discretionary.",
                    finalVerdict: "MODERATE: Valid procedural strategy exists but critical evidentiary weaknesses must be addressed before proceeding to trial."
                })
            } else if (persona === 'auditor') {
                resolve({
                    verdict: "SIMULATION (Auditor): High risk of fiduciary breach due to undisclosed conflicts of interest.",
                    interrogatories: ["Who approved the related-party transaction?", "Where is the independent valuation?", "Why was the board not notified?"],
                    contradiction: "Claims of 'transparency' clash with encrypted side-channel communications.",
                    qwenCritique: "Qwen 3 (Simulated): The auditor correctly identifies the disclosure gap. Fiduciary duty is the primary exposure.",
                    saulCritique: "Saul 7B (Simulated): PCAOB Standard 2410: Auditors must evaluate whether related party transactions have been appropriately identified and disclosed.",
                    bestAnswer: "Immediately disclose all related-party transactions to the board and secure an independent third-party valuation. Document the decision-making process retroactively to establish good faith.",
                    finalVerdict: "CRITICAL RISK: Undisclosed conflicts and encrypted communications create severe fiduciary exposure. Immediate remediation required."
                })
            } else if (persona === 'ip') {
                resolve({
                    verdict: "SIMULATION (IP): Potential infringement detected on existing 'one-click' utility patents.",
                    interrogatories: ["Search for prior art in 2018.", "Is the algorithm non-obvious?", "Do you have a license for the data?"],
                    contradiction: "Claims original work but code snippet matches MIT-licensed library without attribution.",
                    qwenCritique: "Qwen 3 (Simulated): IP focus on prior art is essential. The licensing flaw is a critical weakness.",
                    saulCritique: "Saul 7B (Simulated): *Alice Corp. v. CLS Bank*: Abstract ideas implemented on a computer are not patentable without an 'inventive concept'.",
                    bestAnswer: "Conduct a comprehensive prior art search before proceeding. Add proper MIT license attribution immediately. Consider design-around strategies to avoid the one-click patent claims.",
                    finalVerdict: "WEAK: Multiple IP vulnerabilities identified. Prior art and licensing issues must be resolved before any commercial deployment."
                })
            } else {
                resolve({
                    verdict: "SIMULATION (Jury): This story doesn't add up. He changed his story three times.",
                    interrogatories: ["Why not call the police?", "Is this about justice or money?", "Timeline feels off."],
                    contradiction: "Claimed terror but waited 4 days to report.",
                    qwenCritique: "Qwen 3 (Simulated): The Jury's doubt on credibility is the biggest hurdle here. Emotional resonance is negative.",
                    saulCritique: "Saul 7B (Simulated): Precedent: *State v. Miller* - Juror skepticism on delayed reporting in emotional distress claims is a documented factor in 78% of acquittals.",
                    bestAnswer: "Rebuild credibility with consistent timeline documentation. Explain the 4-day delay with psychological expert testimony on trauma response. Focus less on emotion, more on verifiable facts.",
                    finalVerdict: "MODERATE: Credibility is the central issue. Expert testimony and timeline consistency can recover jury trust."
                })
            }
        }, 2000);
    });
}
