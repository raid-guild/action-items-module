"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  apiFetch,
  ClientApiError,
  type ProjectSummary,
} from "@/lib/client-api";

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectSummary | null;
}) {
  const queryClient = useQueryClient();
  const isCreate = !project;
  const [form, setForm] = useState(() => initialForm(null));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialForm(project));
      setFormError(null);
    }
  }, [open, project]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        portalLinkUrl: form.portalLinkUrl.trim() || null,
      };
      if (!body.title) {
        throw new ClientApiError(
          422,
          "VALIDATION_ERROR",
          "Project name is required.",
        );
      }
      return project
        ? apiFetch<{ project: ProjectSummary }>(
            `/api/v1/projects/${project.id}`,
            { method: "PATCH", body: JSON.stringify(body) },
          )
        : apiFetch<{ project: ProjectSummary }>("/api/v1/projects", {
            method: "POST",
            body: JSON.stringify(body),
          });
    },
    onSuccess: async () => {
      toast.success(isCreate ? "Project created" : "Project updated");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : "Could not save the project.",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>{isCreate ? "New project" : "Edit project"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a project for grouping related action items."
              : "Update the project details used across its action items."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="max-h-[70vh] space-y-5 overflow-y-auto p-6"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name">
            <Input
              value={form.title}
              maxLength={300}
              autoFocus
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              maxLength={100_000}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              className={selectClass}
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ProjectSummary["status"],
                })
              }
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Portal URL" hint="Optional link to this project in the RaidGuild Portal.">
            <Input
              type="url"
              value={form.portalLinkUrl}
              maxLength={2_048}
              placeholder="https://portal.raidguild.org/…"
              onChange={(event) =>
                setForm({ ...form, portalLinkUrl: event.target.value })
              }
            />
          </Field>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreate ? "Create project" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function initialForm(project: ProjectSummary | null) {
  return {
    title: project?.title ?? "",
    description: project?.description ?? "",
    status: project?.status ?? ("open" as ProjectSummary["status"]),
    portalLinkUrl: project?.portalLinkUrl ?? "",
  };
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
