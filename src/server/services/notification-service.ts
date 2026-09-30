import type { Notification } from "@/types/domain";
import { getRepos } from "@/server/repositories/store";
import { NotFoundError } from "@/server/core/errors";

export class NotificationService {
  list(): Notification[] {
    const repos = getRepos();
    return [...repos.notifications.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  unreadCount(): number {
    return this.list().filter((n) => n.readAt === null).length;
  }

  markRead(id: string): Notification {
    const repos = getRepos();
    const found = repos.notifications.get(id);
    if (!found) throw new NotFoundError("Notification", id);
    if (found.readAt === null) {
      found.readAt = new Date().toISOString();
      repos.notifications.save(found);
    }
    return found;
  }
}
