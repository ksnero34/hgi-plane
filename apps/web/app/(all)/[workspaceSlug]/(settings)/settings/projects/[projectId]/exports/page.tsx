import { observer } from "mobx-react";
// params
import { useParams } from "next/navigation";
// components
import { ProjectExports } from "@/components/project/settings/project-exports";
// hooks
import { useProject } from "@/hooks/store/use-project";

const ProjectExportsPage = observer(() => {
  const { projectId } = useParams();
  const { getProjectById } = useProject();

  const currentProject = getProjectById(projectId);

  if (!currentProject) return null;

  return <ProjectExports />;
});

export default ProjectExportsPage;
