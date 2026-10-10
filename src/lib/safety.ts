/**
 * Content-safety heuristics shared by client (warn while typing) and server (enforce).
 * This is the "spam / scam detection architecture": deterministic rules today,
 * with `ContentScreener` as the seam to plug in an ML moderation service later.
 */

export type Severity = "OK" | "WARN" | "BLOCK";

export interface ScreenResult {
  severity: Severity;
  reasons: string[];
}

export interface ContentScreener {
  screen(text: string): ScreenResult;
}

const RULES: { severity: Exclude<Severity, "OK">; test: RegExp; reason: string }[] = [
  // Highly sensitive — never allowed in messages/posts.
  { severity: "BLOCK", test: /\b\d{4}\s?\d{4}\s?\d{4}\b/, reason: "Looks like an Aadhaar number. Never share it in messages or posts." },
  { severity: "BLOCK", test: /\b(?:\d[ -]?){13,16}\b/, reason: "Looks like a card or bank account number." },
  { severity: "BLOCK", test: /\b(otp|one[- ]time password|cvv|upi pin|atm pin|पिन|ओटीपी)\b/i, reason: "Never share an OTP, CVV or PIN — KaamSetu will never ask for it." },
  // Risky — allowed but flagged with a warning.
  { severity: "WARN", test: /\b[a-z0-9._-]{2,}@(?:ok[a-z]+|ybl|ibl|axl|paytm|upi|sbi|hdfcbank|icici)\b/i, reason: "Contains what looks like a UPI ID. Do not pay anyone in advance." },
  { severity: "WARN", test: /\b(advance|token money|registration fee|processing fee|send money|अग्रिम|एडवांस)\b/i, reason: "Be careful with advance payments. Genuine buyers pay after quality check." },
  { severity: "WARN", test: /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/, reason: "Contains a phone number. Share contact details only with people you trust." },
  { severity: "WARN", test: /https?:\/\/\S+/i, reason: "Contains a link. Only open links from people you trust." },
];

export const ruleScreener: ContentScreener = {
  screen(text) {
    const hits = RULES.filter((r) => r.test.test(text));
    const severity: Severity = hits.some((h) => h.severity === "BLOCK") ? "BLOCK" : hits.length ? "WARN" : "OK";
    // Crude spam signals
    const reasons = hits.map((h) => h.reason);
    if (/(.)\1{9,}/.test(text) || (text.match(/!/g)?.length ?? 0) > 8) {
      reasons.push("Looks like spam (repeated characters or excessive punctuation).");
      return { severity: severity === "OK" ? "WARN" : severity, reasons };
    }
    return { severity, reasons };
  },
};

export const screenText = (text: string) => ruleScreener.screen(text);

export const SCAM_WARNING =
  "Never share your bank account, UPI PIN, OTP or Aadhaar. Genuine buyers never need these to place an order. Do not pay anyone in advance.";
