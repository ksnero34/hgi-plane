import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// ui
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { WorkflowManagement } from "@/components/project/settings/workflow-management";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

const WorkflowSettingsPage = observer(() => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails: projectDetails } = useProject();

  // derived values
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  // derived values
  const pageTitle = projectDetails?.name ? `${projectDetails?.name} - 워크플로우` : undefined;

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper>
      <PageHead title={pageTitle} />
      <section className={`w-full ${canPerformProjectAdminActions ? "" : "opacity-60"}`}>
        <SettingsHeading
          title="워크플로우"
          description="프로젝트의 이슈 처리 과정을 자동화하고 체계적으로 관리하세요."
        />
        <WorkflowManagement />
      </section>
    </SettingsContentWrapper>
  );
});

export default WorkflowSettingsPage;
