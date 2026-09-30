import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Runbooks" };

export default function RunbooksPage() {
  return (
    <PlaceholderPage
      title="Runbooks"
      phase={9}
      description="Editable operational procedures for recurring failure modes."
      planned={[
        "Structured runbooks: symptoms, diagnosis, actions, verification",
        "Linked to alert types and incidents",
        "Editable markdown with review history",
        "Escalation and rollback sections",
      ]}
      related={[{ label: "Incidents", href: "/incidents" }, { label: "Postmortems", href: "/postmortems" }]}
    />
  );
}
