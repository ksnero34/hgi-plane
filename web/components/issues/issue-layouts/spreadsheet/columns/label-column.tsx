import React from "react";
import { observer } from "mobx-react-lite";
// components
import { IssuePropertyLabels } from "../../properties";
// hooks
import { useLabel } from "hooks/store";
// types
import { TIssue } from "@plane/types";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetLabelColumn: React.FC<Props> = observer((props: Props) => {
  const { issue, onChange, disabled, onClose } = props;
  // hooks
  const { labelMap } = useLabel();

  const defaultLabelOptions = issue?.label_ids?.map((id) => labelMap[id]) || [];

  return (
    <IssuePropertyLabels
      projectId={issue.project_id ?? null}
      value={issue.label_ids}
      defaultOptions={defaultLabelOptions}
      onChange={(data) => onChange(issue, { label_ids: data }, { changed_property: "labels", change_details: data })}
      className="h-11 w-full border-b-[0.5px] border-neutral-border-medium hover:bg-neutral-component-surface-dark"
      buttonClassName="px-2.5 h-full"
      hideDropdownArrow
      maxRender={1}
      disabled={disabled}
      placeholderText="Select labels"
      onClose={onClose}
    />
  );
});
