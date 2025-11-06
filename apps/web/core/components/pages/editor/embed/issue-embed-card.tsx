import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane ui
import { PriorityIcon } from "@plane/propel/icons";
import { Avatar } from "@plane/ui";
// types
import type { TIssue } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
// plane-web components
import { IssueIdentifier } from "@/plane-web/components/issues/issue-details/issue-identifier";

type Props = {
  issueId: string;
  projectId?: string;
  workspaceSlug?: string;
  attributes: Record<string, any>;
};

const IssueEmbedCardComponent: React.FC<Props> = (props) => {
  const { issueId, projectId, workspaceSlug, attributes } = props;
  // stores
  const { issue } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const { getStateById } = useProjectState();
  const { getUserDetails } = useMember();
  const { handleRedirection } = useIssuePeekOverviewRedirection();

  const [hasRequestedIssue, setHasRequestedIssue] = useState(false);

  const issueDetails = issue.getIssueById(issueId);
  const isFetchingIssueDetails = issue.getIsFetchingIssueDetails(issueId);

  const resolvedProjectId = issueDetails?.project_id ?? projectId ?? attributes?.project_identifier ?? "";

  useEffect(() => {
    if (issueDetails || hasRequestedIssue) return;
    if (!workspaceSlug || !resolvedProjectId || !issueId) return;

    setHasRequestedIssue(true);
    issue.fetchIssue(workspaceSlug, resolvedProjectId, issueId).catch(() => {
      setHasRequestedIssue(false);
    });
  }, [issueDetails, hasRequestedIssue, workspaceSlug, resolvedProjectId, issueId, issue]);

  const projectIdentifier = useMemo(() => {
    if (issueDetails?.project_id) return getProjectIdentifierById(issueDetails.project_id);
    if (resolvedProjectId) return getProjectIdentifierById(resolvedProjectId);
    return attributes?.project_slug;
  }, [attributes?.project_slug, getProjectIdentifierById, issueDetails?.project_id, resolvedProjectId]);

  const sequenceId = issueDetails?.sequence_id ?? attributes?.issue_sequence_id;
  const sequenceIdAsString = sequenceId != null ? String(sequenceId) : undefined;
  const issueTitle = issueDetails?.name ?? attributes?.issue_title ?? "Untitled issue";
  const stateDetails = useMemo(() => {
    const stateId = issueDetails?.state_id ?? attributes?.issue_state_id;
    return stateId ? getStateById(stateId) : undefined;
  }, [attributes?.issue_state_id, getStateById, issueDetails?.state_id]);
  const fallbackStateDetails = useMemo(() => {
    if (stateDetails) return stateDetails;
    if (!attributes?.issue_state_name) return undefined;
    return {
      name: attributes.issue_state_name as string,
      color: attributes.issue_state_color as string | undefined,
    };
  }, [attributes?.issue_state_color, attributes?.issue_state_name, stateDetails]);
  const priority = issueDetails?.priority ?? attributes?.issue_priority;

  // Get assignee details
  const assignees = useMemo(() => {
    const assigneeIds = issueDetails?.assignee_ids ?? [];
    return assigneeIds.map((id) => getUserDetails(id)).filter(Boolean);
  }, [issueDetails?.assignee_ids, getUserDetails]);

  const isLoading = !issueDetails && (isFetchingIssueDetails || !hasRequestedIssue);

  const fallbackIssue = useMemo(() => {
    if (issueDetails) return issueDetails;
    if (!resolvedProjectId || sequenceId == null) return undefined;
    const parsedSequenceId = typeof sequenceId === "number" ? sequenceId : Number(sequenceId);
    return {
      id: issueId,
      project_id: resolvedProjectId,
      sequence_id: Number.isNaN(parsedSequenceId) ? undefined : parsedSequenceId,
      name: issueTitle,
      archived_at: null,
      tempId: undefined,
    } as unknown as TIssue;
  }, [issueDetails, issueId, issueTitle, resolvedProjectId, sequenceId]);

  const handleOpenPeek = useCallback(() => {
    if (!workspaceSlug || !resolvedProjectId) return;
    if (!fallbackIssue) return;
    handleRedirection(workspaceSlug, fallbackIssue);
  }, [fallbackIssue, handleRedirection, resolvedProjectId, workspaceSlug]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpenPeek();
      }
    },
    [handleOpenPeek]
  );

  const identifierNode = useMemo(() => {
    if (issueDetails) {
      const issueProjectId = issueDetails.project_id ?? resolvedProjectId;
      if (issueProjectId) {
        return <IssueIdentifier issueId={issueId} projectId={issueProjectId} size="sm" />;
      }
    }

    if (resolvedProjectId && projectIdentifier && sequenceIdAsString) {
      return (
        <IssueIdentifier
          projectId={resolvedProjectId}
          projectIdentifier={projectIdentifier}
          issueSequenceId={sequenceIdAsString}
          size="sm"
        />
      );
    }

    if (projectIdentifier && sequenceIdAsString) {
      return (
        <span className="text-xs font-medium text-custom-text-300">
          {projectIdentifier}-{sequenceIdAsString}
        </span>
      );
    }

    return <span className="text-xs font-medium text-custom-text-300">Issue</span>;
  }, [issueDetails, issueId, projectIdentifier, resolvedProjectId, sequenceId]);

  return (
    <div
      className={cn(
        "issue-embed cursor-pointer space-y-2 rounded-md bg-custom-background-90 p-3 my-2 border border-transparent transition-colors duration-200",
        "hover:border-custom-border-200 hover:bg-custom-background-80"
      )}
      role="button"
      tabIndex={0}
      onClick={handleOpenPeek}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${issueTitle}`}
      data-issue-id={issueId}
    >
      <div className="flex flex-shrink-0 items-center gap-2">{identifierNode}</div>
      <h4 className="line-clamp-2 break-words text-sm font-medium text-custom-text-100">{issueTitle}</h4>
      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap text-xs text-custom-text-300">
        {isLoading && (
          <span className="animate-pulse rounded bg-custom-background-80 px-2 py-1 text-[10px] uppercase tracking-wide">
            Loading…
          </span>
        )}
        {!isLoading && (stateDetails || fallbackStateDetails) && (
          <span className="flex items-center gap-1 rounded border border-custom-border-300 px-2 py-0.5">
            <span
              className="size-2 rounded-full"
              style={{
                backgroundColor:
                  stateDetails?.color ?? fallbackStateDetails?.color ?? "var(--color-primary-100)",
              }}
            />
            <span className="text-[11px] font-medium capitalize text-custom-text-300">
              {stateDetails?.name ?? fallbackStateDetails?.name}
            </span>
          </span>
        )}
        {!isLoading && priority && (
          <span className="flex items-center gap-1 rounded border border-custom-border-300 px-2 py-0.5">
            <PriorityIcon priority={priority} withContainer size={12} />
            <span className="text-[11px] font-medium capitalize text-custom-text-300">{priority}</span>
          </span>
        )}
        {!isLoading && assignees.length > 0 && (
          <div className="flex items-center gap-1">
            {assignees.slice(0, 3).map((assignee) => assignee && (
              <Avatar
                key={assignee.id}
                name={assignee.display_name}
                src={(assignee as any).avatar}
                size="sm"
                showTooltip={false}
              />
            ))}
            {assignees.length > 3 && (
              <span className="text-[10px] text-custom-text-300">+{assignees.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const IssueEmbedCard = observer(IssueEmbedCardComponent);
