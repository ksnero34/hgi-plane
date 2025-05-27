"use client";

import { observer } from "mobx-react";
// components
import { ProjectExports } from "@/components/project/settings/project-exports";
// hooks
import { useProject } from "@/hooks/store";
// params
import { useParams } from "next/navigation";

const ProjectExportsPage = observer(() => {
  const { projectId } = useParams();
  const { getProjectById } = useProject();
  
  const currentProject = getProjectById(projectId as string);

  if (!currentProject) return null;

  return <ProjectExports />;
});

export default ProjectExportsPage; 