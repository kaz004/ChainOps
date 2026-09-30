import type { Deployment } from "@/types/domain";

export interface DeploymentProvider {
  readonly name: string;
  readonly isDemo: boolean;
  advance(deployment: Deployment, now: number): Deployment;
}
