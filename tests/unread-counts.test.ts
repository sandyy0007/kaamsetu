import { describe, it, expect, beforeEach } from "vitest";
import { call, fresh } from "./helpers";
import type { ConversationDTO, Me, NotificationDTO } from "@/types/dto";

describe("Unread Counts Synchronization", () => {
  beforeEach(() => {
    fresh();
  });

  it("synchronizes unread message counts accurately when conversation is read", async () => {
    // 1. User A starts a conversation with User B
    const startRes = await call<{ conversationId: string }>("POST", "/conversations", {
      as: "u_ramesh",
      body: {
        userId: "u_b_marudhara",
        message: "Hello Marudhara, is your purchase requirement still open?",
      },
    });
    expect(startRes.status).toBe(200);
    const convId = startRes.data.conversationId;

    // 2. Check User B's initial unread messages count
    const meBefore = await call<Me>("GET", "/auth/me", { as: "u_b_marudhara" });
    expect(meBefore.status).toBe(200);
    expect(meBefore.data.unreadMessages).toBeGreaterThanOrEqual(1);

    // 3. User B marks the conversation as read
    const readRes = await call<{ ok: boolean }>("POST", `/conversations/${convId}/read`, {
      as: "u_b_marudhara",
    });
    expect(readRes.status).toBe(200);
    expect(readRes.data.ok).toBe(true);

    // 4. Verify User B's unread count immediately drops to 0
    const meAfter = await call<Me>("GET", "/auth/me", { as: "u_b_marudhara" });
    expect(meAfter.status).toBe(200);
    expect(meAfter.data.unreadMessages).toBe(0);
  });

  it("synchronizes unread notification counts upon reading", async () => {
    // Check initial notification count for a seed user
    const me = await call<Me>("GET", "/auth/me", { as: "u_ramesh" });
    expect(me.status).toBe(200);

    const notifs = await call<NotificationDTO[]>("GET", "/notifications", { as: "u_ramesh" });
    expect(notifs.status).toBe(200);

    if (notifs.data.length > 0) {
      // Mark all read
      const markRes = await call<{ ok: boolean }>("POST", "/notifications/read-all", {
        as: "u_ramesh",
      });
      expect(markRes.status).toBe(200);

      const meAfter = await call<Me>("GET", "/auth/me", { as: "u_ramesh" });
      expect(meAfter.status).toBe(200);
      expect(meAfter.data.unreadNotifications).toBe(0);
    }
  });
});

