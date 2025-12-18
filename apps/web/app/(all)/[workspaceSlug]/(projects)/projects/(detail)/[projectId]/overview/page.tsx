import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { ProjectOverviewRoot } from "@/components/projects/overview";
// hooks
import { useProject } from "@/hooks/store/use-project";

const ProjectOverviewPage = observer(() => {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { getProjectById } = useProject();

  if (!projectId) return null;

  const project = getProjectById(projectId.toString());
  const overviewLabel = t("sidebar.overview");
  const pageTitle = project?.name ? `${project.name} - ${overviewLabel}` : "Project overview";

  return (
    <>
      <PageHead title={pageTitle} />
      <ProjectOverviewRoot />
    </>
  );
});

export default ProjectOverviewPage;
