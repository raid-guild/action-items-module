"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CirclePlus, FolderKanban, Loader2 } from "lucide-react";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, type ProjectSummary } from "@/lib/client-api";

type SessionResponse = {
  authenticated: boolean;
  portalUrl: string;
};

type ProjectList = { projects: ProjectSummary[] };

export function ProjectsApp() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] =
    useState<ProjectSummary | null>(null);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/api/session"),
    retry: false,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<ProjectList>("/api/v1/projects?limit=100"),
    enabled: session.data?.authenticated === true,
  });

  return (
    <main className="min-h-dvh">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4 md:px-6">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
          >
            <Link className="truncate transition-colors hover:text-foreground" href="/">
              Action Items
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">Projects</span>
          </nav>
          <Button
            className="ml-auto"
            size="icon"
            aria-label="Create a new project"
            title="Create a new project"
            disabled={!session.data?.authenticated}
            onClick={() => {
              setSelectedProject(null);
              setDialogOpen(true);
            }}
          >
            <CirclePlus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold">Projects</h1>
            <p className="text-xs text-muted-foreground">
              Organize related action items.
            </p>
          </div>
        </div>

        {session.isLoading || projects.isLoading ? (
          <Centered>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </Centered>
        ) : !session.data?.authenticated ? (
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Launch Action Items from RaidGuild Portal to manage projects.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                window.location.href = session.data?.portalUrl || "/";
              }}
            >
              Return to Portal
            </Button>
          </div>
        ) : projects.error ? (
          <Centered>
            <p className="text-sm text-destructive">{projects.error.message}</p>
          </Centered>
        ) : projects.data?.projects.length ? (
          <div className="overflow-hidden rounded-lg border bg-card/50">
            <ul className="divide-y divide-border">
              {projects.data.projects.map((project) => (
                <li key={project.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/60 focus:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:px-5"
                    onClick={() => {
                      setSelectedProject(project);
                      setDialogOpen(true);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {project.title}
                    </span>
                    <Badge
                      className={
                        project.status === "open"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {project.status === "open" ? "Open" : "Closed"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Centered>
            <div className="text-center">
              <p className="font-medium">No projects yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create the first project to start grouping action items.
              </p>
            </div>
          </Centered>
        )}
      </section>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={selectedProject}
      />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed p-8">
      {children}
    </div>
  );
}
