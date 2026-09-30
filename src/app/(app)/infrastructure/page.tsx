import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Infrastructure" };

export default function InfrastructurePage() {
  return (
    <PlaceholderPage
      title="Infrastructure"
      phase={3}
      description="Inventory of clusters, nodes, workloads and their utilization."
      planned={[
        "Cluster overview: nodes, health, CPU/memory saturation",
        "Namespaces, pods, deployments, services, ingress",
        "Databases and queues inventory",
        "Resource optimization: requested vs actual usage",
      ]}
      related={[{ label: "Observability", href: "/observability" }]}
    />
  );
}
