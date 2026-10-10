import type { Db, NotificationType } from "@/types/domain";
import { newId } from "../crypto";

/** Creates an in-app notification unless the user switched that category off. (Push delivery hooks in here later.) */
export function notify(d: Db, userId: string, type: NotificationType, title: string, body: string, link: string) {
  const user = d.users.find((u) => u.id === userId);
  if (!user || user.notificationPrefs[type] === false) return;
  d.notifications.push({ id: newId("n"), userId, type, title, body, link, read: false, createdAt: new Date().toISOString(), isDemo: false });
  // Push-notification architecture: enqueue a Web Push job for `userId` here (see README → Notifications).
}
