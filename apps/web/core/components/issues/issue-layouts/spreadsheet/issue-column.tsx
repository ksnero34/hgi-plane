import { useRef } from "react";
import { observer } from "mobx-react";
// types
import { WORK_ITEM_TRACKER_EVENTS } from "@plane/constants";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// hooks
import { captureSuccess } from "@/helpers/event-tracker.helper";
// components
import { SPREADSHEET_COLUMNS } from "@/plane-web/components/issues/issue-layouts/utils";
import { shouldRenderColumn } from "@/plane-web/helpers/issue-filter.helper";
import { WithDisplayPropertiesHOC } from "../properties/with-display-properties-HOC";

type Props = {
  displayProperties: IIssueDisplayProperties;
  issueDetail: TIssue;
  disableUserActions: boolean;
  property: keyof IIssueDisplayProperties;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  isEstimateEnabled: boolean;
};

export const IssueColumn = observer(function IssueColumn(props: Props) {
  const { displayProperties, issueDetail, disableUserActions, property, updateIssue } = props;
  // router
  const tableCellRef = useRef<HTMLTableCellElement | null>(null);

  const shouldRenderProperty = shouldRenderColumn(property);

  const Column = SPREADSHEET_COLUMNS[property];

  if (!Column) return null;

  return (
    <WithDisplayPropertiesHOC
      displayProperties={displayProperties}
      displayPropertyKey={property}
      shouldRenderProperty={() => shouldRenderProperty}
    >
      <td
        tabIndex={0}
        className="h-11 min-w-36 text-sm after:absolute after:w-full after:bottom-[-1px] after:border after:border-custom-border-100 border-r-[1px] border-custom-border-100"
        ref={tableCellRef}
      >
        <Column
          issue={issueDetail}
          onChange={(issue: TIssue, data: Partial<TIssue>) =>
            updateIssue &&
            updateIssue(issue.project_id, issue.id, data)
              .then(() => {
                captureSuccess({
                  eventName: WORK_ITEM_TRACKER_EVENTS.update,
                  payload: {
                    id: issue.id,
                  },
                });
              })
              .catch((error: any) => {
                console.error("Issue update failed:", error);
                console.error("Error details:", {
                  status: error?.response?.status,
                  data: error?.response?.data,
                  message: error?.message,
                });

                // Extract detailed error message
                let errorMessage = "이슈 업데이트 실패";
                let errorTitle = "업데이트 실패";

                // Handle workflow-specific errors
                if (error?.response?.status === 400) {
                  if (error?.response?.data?.non_field_errors?.[0]) {
                    errorMessage = error.response.data.non_field_errors[0];
                  } else if (error?.response?.data?.detail) {
                    errorMessage = error.response.data.detail;
                  } else if (error?.response?.data?.error) {
                    errorMessage = error.response.data.error;
                  } else if (error?.response?.data?.message) {
                    errorMessage = error.response.data.message;
                  }

                  // Check for workflow-related errors
                  if (
                    errorMessage.includes("workflow") ||
                    errorMessage.includes("transition") ||
                    errorMessage.includes("승인")
                  ) {
                    errorTitle = "워크플로우 규칙 위반";
                  }
                } else if (error?.message) {
                  errorMessage = error.message;
                }

                setToast({
                  type: TOAST_TYPE.ERROR,
                  title: errorTitle,
                  message: errorMessage,
                });
              })
          }
          disabled={disableUserActions}
          onClose={() => tableCellRef?.current?.focus()}
        />
      </td>
    </WithDisplayPropertiesHOC>
  );
});
