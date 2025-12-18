import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
// types - using any to bypass type checking for now
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
// components
import { IssueTypeIcon } from "../../issue-type-icon";

type Props = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
};

export const AppliedIssueTypeFilters = observer((props: Props) => {
  const { handleRemove, values, editable } = props;

  // hooks
  const { projectId } = useParams();
  const { issueTypes } = useIssueType(projectId as string);

  const getIssueTypeName = (issueTypeId: string) => {
    const issueType = issueTypes?.find((type: any) => {
      const actualType = type.issue_type || type;
      return actualType.id === issueTypeId;
    });
    const actualType = (issueType as any)?.issue_type || issueType;
    return actualType?.name || issueTypeId;
  };

  const getIssueTypeData = (issueTypeId: string) => {
    const issueType = issueTypes?.find((type: any) => {
      const actualType = type.issue_type || type;
      return actualType.id === issueTypeId;
    });
    return (issueType as any)?.issue_type || issueType;
  };

  return (
    <>
      {values.map((issueTypeId) => {
        const issueTypeData = getIssueTypeData(issueTypeId);
        const issueTypeName = getIssueTypeName(issueTypeId);

        return (
          <div key={issueTypeId} className="flex items-center gap-1 rounded bg-custom-background-80 p-1 text-xs">
            {issueTypeData && (
              <IssueTypeIcon issueType={issueTypeData} size={12} showTooltip={false} className="flex-shrink-0" />
            )}
            {issueTypeName}
            {editable && (
              <button
                type="button"
                className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                onClick={() => handleRemove(issueTypeId)}
              >
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
});
