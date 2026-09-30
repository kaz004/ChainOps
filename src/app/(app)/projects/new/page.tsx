import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectForm } from "@/features/projects/project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-6">
      <PageHeader
        title="Create project"
        description="Connect a repository, pick target chains and start operating."
      />
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            Repository analysis, deployment plans and service detection follow in later phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            mode="create"
            defaults={{
              name: "",
              description: "",
              repoUrl: "",
              defaultBranch: "main",
              ownerName: "Adrian Vale",
              environment: "production",
              chainNetworks: ["base"],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
