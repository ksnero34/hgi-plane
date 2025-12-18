import type { FC } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { ContentWrapper } from "@plane/ui";
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { InboxIssueActionsHeader } from "./inbox-issue-header";
import { InboxIssueMainContent } from "./issue-root";

type TInboxContentRoot = {
  workspaceSlug: string;
  projectId: string;
  inboxIssueId: string;
  isMobileSidebar: boolean;
  setIsMobileSidebar: (value: boolean) => void;
  isNotificationEmbed?: boolean;
  embedRemoveCurrentNotification?: () => void;
};

export const InboxContentRoot = observer(function InboxContentRoot(props: TInboxContentRoot) {
  const {
    workspaceSlug,
    projectId,
    inboxIssueId,
    isMobileSidebar,
    setIsMobileSidebar,
    isNotificationEmbed = false,
    embedRemoveCurrentNotification,
  } = props;
  /// router
  const router = useAppRouter();
  // states
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  // hooks
  const { data: currentUser } = useUser();
  const { checkIssueEditPermission } = useUserPermissions();
  const { currentTab, fetchInboxIssueById, getIssueInboxByIssueId, getIsIssueAvailable } = useProjectInbox();
  const inboxIssue = getIssueInboxByIssueId(inboxIssueId);
  const { allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();

  // derived values
  const isIssueAvailable = getIsIssueAvailable(inboxIssueId?.toString() || "");

  useEffect(() => {
    if (!isIssueAvailable && inboxIssueId && !isNotificationEmbed) {
      router.replace(`/${workspaceSlug}/projects/${projectId}/intake?currentTab=${currentTab}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIssueAvailable, isNotificationEmbed]);

  useSWR(
    workspaceSlug && projectId && inboxIssueId
      ? `PROJECT_INBOX_ISSUE_DETAIL_${workspaceSlug}_${projectId}_${inboxIssueId}`
      : null,
    workspaceSlug && projectId && inboxIssueId
      ? () => fetchInboxIssueById(workspaceSlug, projectId, inboxIssueId)
      : null,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
    }
  );

  // 권한 체크 로깅
  // console.log("Inbox Issue Details:", {
  //   workspaceSlug,
  //   projectId,
  //   assignees: inboxIssue?.issue?.assignee_ids,
  //   currentUserId: currentUser?.id,
  //   issue: inboxIssue?.issue
  // });

  // checking if issue is editable, based on user role
  const isEditable =
    checkIssueEditPermission(workspaceSlug, projectId, inboxIssue?.issue?.assignee_ids || [], currentUser?.id || "") ||
    inboxIssue?.issue.created_by === currentUser?.id;

  // 권한 상태 로깅
  // console.log("Inbox Permission Check:", {
  //   isEditable,
  //   currentUser: currentUser?.id,
  //   assignees: inboxIssue?.issue?.assignee_ids,
  //   workspaceSlug,
  //   projectId
  // });

  const isGuest = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId) === EUserPermissions.GUEST;
  const isOwner = inboxIssue?.issue.created_by === currentUser?.id;
  const readOnly = !isOwner && isGuest;

  if (!inboxIssue) return <></>;

  const isIssueDisabled = [-1, 1, 2].includes(inboxIssue.status);

  return (
    <>
      <div className="w-full h-full overflow-hidden relative flex flex-col">
        <div className="flex-shrink-0 min-h-[52px] z-[11]">
          <InboxIssueActionsHeader
            setIsMobileSidebar={setIsMobileSidebar}
            isMobileSidebar={isMobileSidebar}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            inboxIssue={inboxIssue}
            isSubmitting={isSubmitting}
            isNotificationEmbed={isNotificationEmbed || false}
            embedRemoveCurrentNotification={embedRemoveCurrentNotification}
          />
        </div>
        <ContentWrapper className="space-y-5 divide-y-2 divide-custom-border-200">
          <InboxIssueMainContent
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            inboxIssue={inboxIssue}
            isEditable={isEditable && !isIssueDisabled && !readOnly}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
          />
        </ContentWrapper>
      </div>
    </>
  );
});
