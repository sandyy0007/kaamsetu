import { z } from "zod";
import type { Conversation, NotificationType } from "@/types/domain";
import type { AIMessageDTO, ConversationDTO, MessageDTO, Page } from "@/types/dto";
import { aiChatSchema, messageSchema, startConversationSchema } from "@/lib/schemas";
import { persist } from "../../db";
import { forbidden, notFound } from "../../errors";
import { summaryById, type View } from "../../mappers";
import { requireUser } from "../../permissions";
import { isBlockedEitherWay } from "../../privacy";
import { answer } from "../../services/ai";
import { ensureConversation, sendMessage } from "../../services/messaging";
import { opportunitiesFor } from "../../services/opportunities";
import { globalSearch } from "../../services/search";
import { route, type Ctx } from "../router";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });

// ───────────── notifications ─────────────
route("GET", "/notifications", (c): Page<unknown> & { unread: number } => {
  const u = requireUser(c.user);
  const type = c.query.get("type") as NotificationType | null;
  const all = c.d.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = type ? all.filter((n) => n.type === type) : all;
  const start = Number(c.query.get("cursor") ?? 0) || 0;
  const limit = 20;
  return { items: rows.slice(start, start + limit), nextCursor: start + limit < rows.length ? String(start + limit) : null, total: rows.length, unread: all.filter((n) => !n.read).length };
});

route("POST", "/notifications/read", async (c) => {
  const u = requireUser(c.user);
  const { ids, all } = await c.body(z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() }));
  c.d.notifications.filter((n) => n.userId === u.id && (all || ids?.includes(n.id))).forEach((n) => (n.read = true));
  persist();
  return { unread: c.d.notifications.filter((n) => n.userId === u.id && !n.read).length };
});

// ───────────── messaging ─────────────
function convoDTO(c: Ctx, convo: Conversation): ConversationDTO {
  const u = c.user!;
  const msgs = c.d.messages.filter((m) => m.conversationId === convo.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = msgs[msgs.length - 1];
  const otherId = convo.participantIds.find((id) => id !== u.id) ?? u.id;
  return {
    id: convo.id,
    participants: convo.participantIds.map((id) => summaryById(c.d, id)),
    other: summaryById(c.d, otherId),
    context: convo.context,
    lastMessage: last && { body: last.body, createdAt: last.createdAt, senderId: last.senderId },
    unread: msgs.filter((m) => m.senderId !== u.id && !m.readBy.includes(u.id)).length,
    updatedAt: convo.updatedAt,
  };
}

function mineOrThrow(c: Ctx, id: string) {
  const u = requireUser(c.user);
  const convo = c.d.conversations.find((x) => x.id === id && x.participantIds.includes(u.id));
  if (!convo) throw notFound("Conversation");
  return convo;
}

route("GET", "/conversations", (c) => {
  const u = requireUser(c.user);
  return c.d.conversations
    .filter((x) => x.participantIds.includes(u.id) && !x.participantIds.some((id) => id !== u.id && isBlockedEitherWay(c.d, u.id, id)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((x) => convoDTO(c, x));
});

route("GET", "/conversations/:id", (c) => {
  const u = requireUser(c.user);
  const convo = mineOrThrow(c, c.params.id!);
  c.d.messages.filter((m) => m.conversationId === convo.id && m.senderId !== u.id && !m.readBy.includes(u.id)).forEach((m) => m.readBy.push(u.id));
  persist();
  const messages: MessageDTO[] = c.d.messages
    .filter((m) => m.conversationId === convo.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ id: m.id, body: m.body, senderId: m.senderId, createdAt: m.createdAt, read: m.readBy.some((id) => id !== m.senderId), attachments: m.attachments }));
  const otherId = convo.participantIds.find((id) => id !== u.id);
  return { conversation: convoDTO(c, convo), messages, blocked: !!otherId && isBlockedEitherWay(c.d, u.id, otherId) };
});

route("POST", "/conversations", async (c) => {
  const u = requireUser(c.user);
  const input = await c.body(startConversationSchema);
  const other = c.d.users.find((x) => x.id === input.userId);
  if (!other || other.id === u.id) throw notFound("User");
  if (isBlockedEitherWay(c.d, u.id, other.id)) throw forbidden("You cannot message this person.");
  const convo = ensureConversation(c.d, u.id, other.id, input.context);
  sendMessage(c.d, convo, u, input.message);
  persist();
  return { conversationId: convo.id };
});

route("POST", "/conversations/:id/messages", async (c) => {
  const u = requireUser(c.user);
  const convo = mineOrThrow(c, c.params.id!);
  const input = await c.body(messageSchema);
  const m = sendMessage(c.d, convo, u, input.body, input.attachments ?? []);
  // A reply from the farmer marks the related enquiry as replied.
  c.d.enquiries.filter((e) => e.conversationId === convo.id && e.farmerId === u.id && e.status === "NEW").forEach((e) => (e.status = "REPLIED"));
  persist();
  return { id: m.id, body: m.body, senderId: m.senderId, createdAt: m.createdAt, read: false, attachments: m.attachments } satisfies MessageDTO;
});

// ───────────── AI assistant ─────────────
route("POST", "/ai/chat", async (c) => {
  const u = requireUser(c.user);
  const { message, conversationId } = await c.body(aiChatSchema);
  const { conversationId: id, reply } = await answer(c.d, u, message, conversationId);
  persist();
  return { conversationId: id, reply: { id: reply.id, role: reply.role, content: reply.content, actions: reply.actions, followUps: reply.followUps, createdAt: reply.createdAt } satisfies AIMessageDTO };
});

route("GET", "/ai/history", (c) => {
  const u = requireUser(c.user);
  const convo = c.d.aiConversations.filter((x) => x.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!convo) return { conversationId: null, messages: [] as AIMessageDTO[] };
  const messages: AIMessageDTO[] = c.d.aiMessages
    .filter((m) => m.conversationId === convo.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ id: m.id, role: m.role, content: m.content, actions: m.actions, followUps: m.followUps, createdAt: m.createdAt }));
  return { conversationId: convo.id, messages };
});

route("DELETE", "/ai/history", (c) => {
  const u = requireUser(c.user);
  const ids = new Set(c.d.aiConversations.filter((x) => x.userId === u.id).map((x) => x.id));
  c.d.aiMessages = c.d.aiMessages.filter((m) => !ids.has(m.conversationId));
  c.d.aiConversations = c.d.aiConversations.filter((x) => x.userId !== u.id);
  persist();
  return { ok: true };
});

// ───────────── discovery ─────────────
route("GET", "/opportunities", (c) => {
  requireUser(c.user);
  const kinds = c.query.get("kinds")?.split(",").filter(Boolean);
  const all = opportunitiesFor(view(c));
  return kinds?.length ? all.filter((o) => kinds.includes(o.kind)) : all;
});

route("GET", "/search", (c) => {
  requireUser(c.user);
  const q = (c.query.get("q") ?? "").trim();
  return globalSearch(view(c), q.slice(0, 80));
});
