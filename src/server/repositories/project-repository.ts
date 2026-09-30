import type { Project, ProjectStatus } from "@/types/domain";

/**
 * ProjectRepository port + deterministic in-memory adapter (docs/01 §6,
 * spec §46). The service depends only on the interface; a SQL adapter can
 * replace the implementation without touching the service layer.
 */

export interface ProjectRepository {
  all(): Project[];
  getById(id: string): Project | undefined;
  getBySlug(slug: string): Project | undefined;
  insert(project: Project): Project;
  save(project: Project): Project;
  countByStatus(status: ProjectStatus): number;
}

/** Deterministic in-memory implementation. */
export class InMemoryProjectRepository implements ProjectRepository {
  private items = new Map<string, Project>();

  constructor(seed: Project[] = []) {
    for (const project of seed) {
      this.items.set(project.id, project);
    }
  }

  all(): Project[] {
    return [...this.items.values()];
  }

  getById(id: string): Project | undefined {
    return this.items.get(id);
  }

  getBySlug(slug: string): Project | undefined {
    return this.items.get(`prj-${slug}`) ?? this.all().find((p) => p.slug === slug);
  }

  insert(project: Project): Project {
    if (this.items.has(project.id)) {
      throw new Error(`Project ${project.id} already exists`);
    }
    this.items.set(project.id, project);
    return project;
  }

  save(project: Project): Project {
    this.items.set(project.id, project);
    return project;
  }

  countByStatus(status: ProjectStatus): number {
    let count = 0;
    for (const p of this.items.values()) {
      if (p.status === status) count += 1;
    }
    return count;
  }
}
