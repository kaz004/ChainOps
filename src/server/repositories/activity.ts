import type { ActivityEvent } from "@/types/domain";

export class ActivityStore {
  private events: ActivityEvent[] = [];

  append(event: ActivityEvent): void {
    this.events.push(event);
  }

  /** Newest first. */
  recent(limit: number): ActivityEvent[] {
    return this.events.slice(-limit).reverse();
  }

  count(): number {
    return this.events.length;
  }
}
