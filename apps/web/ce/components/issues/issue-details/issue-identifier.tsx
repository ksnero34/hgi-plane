import { FC } from "react";
import { observer } from "mobx-react";
// types
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { IIssueDisplayProperties } from "@plane/types";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useIssueType } from "@/hooks/store/use-issue-type";
import { IssueTypeIcon } from "../issue-type-icon";

type TIssueIdentifierBaseProps = {
  projectId: string;
  size?: "xs" | "sm" | "md" | "lg";
  textContainerClassName?: string;
  displayProperties?: IIssueDisplayProperties | undefined;
  enableClickToCopyIdentifier?: boolean;
};

type TIssueIdentifierFromStore = TIssueIdentifierBaseProps & {
  issueId: string;
};

type TIssueIdentifierWithDetails = TIssueIdentifierBaseProps & {
  issueTypeId?: string | null;
  projectIdentifier: string;
  issueSequenceId: string | number;
};

export type TIssueIdentifierProps = TIssueIdentifierFromStore | TIssueIdentifierWithDetails;

type TIssueTypeIdentifier = {
  issueId: string;
  size?: "xs" | "sm" | "md" | "lg";
};

export const IssueTypeIdentifier = observer((props: TIssueTypeIdentifier) => {
  const { issueId, size = "sm" } = props;
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = getIssueById(issueId);
  const projectId = issue?.project_id;
  const { issueTypes, getDefaultIssueType } = useIssueType(projectId || "");

  let issueType = issueTypes.find((it) => it.id === issue?.type_id);

  // 이슈에 type_id가 없거나 매치되지 않으면 기본 이슈 타입 사용
  if (!issueType && !issue?.type_id) {
    issueType = getDefaultIssueType();
  }

  // console.log('IssueTypeIdentifier debug:', {
  //   issueId,
  //   projectId,
  //   issueTypes,
  //   issueType,
  //   issueTypeIdFromIssue: issue?.type_id
  // });

  if (!issueType) return null;

  const iconSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
  }[size];

  return <IssueTypeIcon issueType={issueType} size={iconSize} />;
});

type TIdentifierTextProps = {
  identifier: string;
  enableClickToCopyIdentifier?: boolean;
  textContainerClassName?: string;
};

export function IdentifierText(props: TIdentifierTextProps) {
  const { identifier, enableClickToCopyIdentifier = false, textContainerClassName } = props;
  // handlers
  const handleCopyIssueIdentifier = () => {
    if (enableClickToCopyIdentifier) {
      navigator.clipboard.writeText(identifier).then(() => {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "작업 항목 ID가 클립보드에 복사되었습니다!",
        });
      });
    }
  };

  return (
    <Tooltip tooltipContent="Click to copy" disabled={!enableClickToCopyIdentifier} position="top">
      <span
        className={cn(
          "text-base font-medium text-custom-text-300",
          {
            "cursor-pointer": enableClickToCopyIdentifier,
          },
          textContainerClassName
        )}
        onClick={handleCopyIssueIdentifier}
      >
        {identifier}
      </span>
    </Tooltip>
  );
}

export const IssueIdentifier = observer(function IssueIdentifier(props: TIssueIdentifierProps) {
  const { projectId, textContainerClassName, displayProperties, enableClickToCopyIdentifier = false } = props;
  // store hooks
  const { getProjectIdentifierById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // Determine if the component is using store data or not
  const isUsingStoreData = "issueId" in props;
  // derived values
  const issue = isUsingStoreData ? getIssueById(props.issueId) : null;
  const issueTypeId = isUsingStoreData ? issue?.type_id : "issueTypeId" in props ? props.issueTypeId : null;
  const projectIdentifier = isUsingStoreData ? getProjectIdentifierById(projectId) : props.projectIdentifier;
  const issueSequenceId = isUsingStoreData ? issue?.sequence_id : props.issueSequenceId;
  const shouldRenderIssueID = displayProperties ? displayProperties.key : true;
  const shouldRenderIssueType = displayProperties ? displayProperties.issue_type !== false : true;

  // Debug logging
  // console.log('IssueIdentifier debug:', {
  //   issueId: isUsingStoreData ? props.issueId : 'not using store',
  //   issueTypeId,
  //   shouldRenderIssueType,
  //   displayProperties,
  //   issue: isUsingStoreData ? issue : null
  // });

  if (!shouldRenderIssueID && !shouldRenderIssueType) return null;

  return (
    <div className="shrink-0 flex items-center space-x-2">
      {shouldRenderIssueType && isUsingStoreData && <IssueTypeIdentifier issueId={props.issueId} size={props.size} />}
      {shouldRenderIssueID && (
        <IdentifierText
          identifier={`${projectIdentifier}-${issueSequenceId}`}
          enableClickToCopyIdentifier={enableClickToCopyIdentifier}
          textContainerClassName={textContainerClassName}
        />
      )}
    </div>
  );
});
