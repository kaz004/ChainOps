/**
 * Repository contract (docs/01 §6). In-memory v0; SQL implementation drops in
 * later without changing services.
 */

export interface Repository<T> {
  all(): T[];
  get(id: string): T | undefined;
  insert(entity: T): T;
  save(entity: T): T;
  delete(id: string): boolean;
}
