import type { Repository } from "./types";

/**
 * Generic in-memory repository. Insertion-ordered, safe for demo scale.
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private items = new Map<string, T>();

  all(): T[] {
    return [...this.items.values()];
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  insert(entity: T): T {
    if (this.items.has(entity.id)) {
      throw new Error(`Entity ${entity.id} already exists in repository`);
    }
    this.items.set(entity.id, entity);
    return entity;
  }

  save(entity: T): T {
    this.items.set(entity.id, entity);
    return entity;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }
}
