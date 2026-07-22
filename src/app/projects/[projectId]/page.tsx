import type { Metadata } from "next";
import { ProjectDashboardApp } from "@/components/projects/project-dashboard-app";

export const metadata: Metadata = { title: "Project dashboard · Action Items · RaidGuild" };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDashboardApp projectId={projectId} />;
}
