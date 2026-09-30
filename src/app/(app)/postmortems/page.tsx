import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Postmortems" };

export default function PostmortemsPage() {
  return (
    <PlaceholderPage
      title="Postmortems"
      phase={9}
      description="Blameless incident analysis with AI-drafted, human-reviewed reports."
      planned={[
        "Postmortem template: summary, impact, timeline, root cause",
        "AI draft generation from incident data — editable before save",
        "Action items with owners and tracking",
        "What went well / what went poorly sections",
      ]}
      related={[{ label: "Incidents", href: "/incidents" }, { label: "Runbooks", href: "/runbooks" }]}
    />
  );
}
