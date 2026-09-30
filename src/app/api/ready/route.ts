import { NextResponse } from "next/server";
import { getRepos } from "@/server/repositories/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const repos = getRepos();
  const seeded = repos.projects.all().length > 0;
  return NextResponse.json(
    {
      data: {
        status: seeded ? "ready" : "seeding",
        checks: { repositories: seeded },
      },
    },
    { status: seeded ? 200 : 503 },
  );
}
