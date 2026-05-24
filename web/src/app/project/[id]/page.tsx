import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project/project-detail";
import { findProject, projects } from "@/lib/mock-data";

type PageProps = {
  params: {
    id: string;
  };
};

export function generateStaticParams() {
  return projects.map((project) => ({ id: project.id }));
}

export default function ProjectPage({ params }: PageProps) {
  const project = findProject(params.id);

  if (!project) {
    notFound();
  }

  return <ProjectDetail project={project} />;
}
