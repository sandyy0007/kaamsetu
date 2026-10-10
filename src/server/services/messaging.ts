import type { Conversation, Db, Message, User } from "@/types/domain";
import { screenText } from "@/lib/safety";
import { newId } from "../crypto";
import { ApiException } from "../errors";
import { isBlockedEitherWay } from "../privacy";
import { notify } from "./notify";

/** Server-side enforcement of the shared safety screener (credentials / IDs are never allowed). */
export function assertSafeText(text: string) {
  const r = screenText(text);
  if (r.severity === "BLOCK") throw new ApiException(422, "SENSITIVE_CONTENT", r.reasons[0] ?? "This message contains sensitive information that should not be shared.");
}

export function ensureConversation(d: Db, a: string, b: string, context?: Conversation["context"]): Conversation {
  const same = (c: Conversation) =>
    c.participantIds.length === 2 && c.participantIds.includes(a) && c.participantIds.includes(b) && (context?.id ? c.context?.id === context.id && c.context.kind === context.kind : !c.context || c.context.kind === "DIRECT");
  const existing = d.conversations.find(same);
  if (existing) return existing;
  const now = new Date().toISOString();
  const convo: Conversation = { id: newId("cv"), participantIds: [a, b], context: context ?? { kind: "DIRECT", title: "Direct message" }, createdAt: now, updatedAt: now, isDemo: false };
  d.conversations.push(convo);
  return convo;
}

export function sendMessage(d: Db, convo: Conversation, sender: User, body: string, attachments: Message["attachments"] = []): Message {
  const other = convo.participantIds.find((id) => id !== sender.id);
  if (other && isBlockedEitherWay(d, sender.id, other)) throw new ApiException(403, "BLOCKED", "You cannot message this person.");
  assertSafeText(body);
  const now = new Date().toISOString();
  const msg: Message = { id: newId("ms"), conversationId: convo.id, senderId: sender.id, body, attachments, readBy: [sender.id], createdAt: now, isDemo: false };
  d.messages.push(msg);
  convo.updatedAt = now;
  if (other) notify(d, other, "ENQUIRY", `New message from ${sender.name}`, body.slice(0, 80), `/messages?c=${convo.id}`);
  return msg;
}
