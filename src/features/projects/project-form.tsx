"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProjectSchema, updateProjectSchema, type CreateProjectInput, type UpdateProjectInput } from "@/server/services/project-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ENVIRONMENTS, CHAIN_NETWORKS } from "@/types/domain";

export type ProjectFormValues = {
  name: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  ownerName: string;
  environment: (typeof ENVIRONMENTS)[number];
  chainNetworks: (typeof CHAIN_NETWORKS)[number][];
};

interface ProjectFormProps {
  mode: "create" | "edit";
  projectSlug?: string;
  defaults: ProjectFormValues;
  /** Called after successful submit; defaults to router.refresh(). */
  onSuccess?: () => void;
}

export function ProjectForm({ mode, projectSlug, defaults, onSuccess }: ProjectFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(
      mode === "create" ? (createProjectSchema as never) : (updateProjectSchema as never),
    ),
    defaultValues: defaults,
  });

  async function onSubmit(values: ProjectFormValues) {
    setSubmitError(null);
    try {
      const res = await fetch(
        mode === "create" ? "/api/projects" : `/api/projects/${projectSlug}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const payload = (await res.json()) as
        | { data: { slug: string } }
        | { error: { message: string } };
      if (!res.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error.message : "Request failed");
      }
      toast({
        kind: "success",
        title: mode === "create" ? "Project created" : "Project updated",
        description: `${values.name} saved successfully.`,
      });
      if (mode === "create") {
        router.push(`/projects/${payload.data.slug}`);
      } else {
        onSuccess?.();
        router.refresh();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {submitError ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="pf-name" error={errors.name?.message}>
          <Input id="pf-name" placeholder="GoaPass" aria-invalid={Boolean(errors.name)} {...register("name")} />
        </Field>
        <Field label="Owner" htmlFor="pf-owner" error={errors.ownerName?.message}>
          <Input id="pf-owner" placeholder="Adrian Vale" aria-invalid={Boolean(errors.ownerName)} {...register("ownerName")} />
        </Field>
      </div>

      <Field label="Description" htmlFor="pf-desc" error={errors.description?.message}>
        <Textarea
          id="pf-desc"
          rows={3}
          placeholder="What this platform does and who it serves…"
          aria-invalid={Boolean(errors.description)}
          {...register("description")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repository (owner/repo)" htmlFor="pf-repo" error={errors.repoUrl?.message}>
          <Input id="pf-repo" placeholder="acme/goapass" aria-invalid={Boolean(errors.repoUrl)} {...register("repoUrl")} />
        </Field>
        <Field label="Default branch" htmlFor="pf-branch" error={errors.defaultBranch?.message}>
          <Input id="pf-branch" placeholder="main" aria-invalid={Boolean(errors.defaultBranch)} {...register("defaultBranch")} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">Environment</legend>
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENTS.map((env) => (
            <label
              key={env}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input type="radio" value={env} className="accent-[hsl(var(--primary))]" {...register("environment")} />
              {env}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">Target chains</legend>
        <div className="flex flex-wrap gap-2">
          {CHAIN_NETWORKS.map((network) => (
            <label
              key={network}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input type="checkbox" value={network} className="accent-[hsl(var(--primary))]" {...register("chainNetworks")} />
              {network}
            </label>
          ))}
        </div>
        {errors.chainNetworks?.message ? (
          <p role="alert" className="text-xs text-destructive">{String(errors.chainNetworks.message)}</p>
        ) : null}
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5")}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

// Keep UpdateProjectInput referenced for consumers building partial patches.
export type { CreateProjectInput, UpdateProjectInput };
