import React from "react";
import { observer } from "mobx-react";
// types
import { TIssue, TCustomField } from "@plane/types";
// components
import { IssueCustomFieldProperties } from "../../properties";

type Props = {
  issue: TIssue;
  customField: TCustomField;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetSingleCustomFieldColumn: React.FC<Props> = observer((props: Props) => {
  const { issue, customField, onChange, disabled, onClose } = props;

  const handleCustomFieldUpdate = async (projectId: string | null, issueId: string, data: Partial<TIssue>) => {
    if (onChange) {
      onChange(issue, data, { 
        changed_property: "custom_fields", 
        change_details: data.custom_field_values 
      });
    }
  };

  return (
    <div className="h-11 border-b-[0.5px] border-custom-border-200 w-full">
      <div className="h-full w-full flex items-center px-2.5 py-1">
        <IssueCustomFieldProperties
          issue={issue}
          updateIssue={handleCustomFieldUpdate}
          isReadOnly={disabled}
          activeLayout="spreadsheet"
          displayProperties={{ custom_fields: true }}
          customFields={[customField]} // 단일 커스텀 필드만 전달
        />
      </div>
    </div>
  );
}); 