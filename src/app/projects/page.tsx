import type { Metadata } from "next";
import { ProjectsApp } from "@/components/projects/projects-app";

export const metadata: Metadata = {
  title: "Projects · Action Items · RaidGuild",
};

export default function ProjectsPage() {
  return <ProjectsApp />;
}
