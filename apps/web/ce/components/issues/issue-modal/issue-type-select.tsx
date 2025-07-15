import React, { useMemo } from "react";
import { Control, Controller } from "react-hook-form";
// plane imports
import { EditorRefApi } from "@plane/editor";
// types
import { TBulkIssueProperties, TIssue } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";

export type TIssueFields = TIssue & TBulkIssueProperties;

export type TIssueTypeDropdownVariant = "xs" | "sm";

import { IIssueType } from "@plane/types";

export type TIssueTypeSelectProps<T extends Partial<TIssueFields>> = {
  control: Control<T>;
  projectId: string | null;
  editorRef?: React.MutableRefObject<EditorRefApi | null>;
  disabled?: boolean;
  variant?: TIssueTypeDropdownVariant;
  placeholder?: string;
  isRequired?: boolean;
  renderChevron?: boolean;
  dropDownContainerClassName?: string;
  showMandatoryFieldInfo?: boolean; // Show info about mandatory fields
  handleFormChange?: () => void;
  onTypeChange?: (type: IIssueType | undefined) => void;
};

export const IssueTypeSelect = <T extends Partial<TIssueFields>>({
  control,
  projectId,
  disabled = false,
  placeholder = "Select issue type",
  renderChevron = false,
  dropDownContainerClassName,
  handleFormChange,
  onTypeChange,
}: TIssueTypeSelectProps<T>) => {
  const { issueTypes } = useIssueType(projectId || "");
  
  const memoizedIssueTypes = useMemo(() => issueTypes, [issueTypes]);
  
  return (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <div className="w-full">
        <Controller
          control={control}
          name="type_id" as keyof T
          render={({ field: { onChange, value } }) => (
            <IssueTypeDropdown
              value={value}
              onChange={(val: string) => {
                onChange(val);
                // IssueType 객체 찾기
                const selectedIssueType = projectId && val ? 
                  memoizedIssueTypes?.find(pt => (pt.issue_type || pt).id === val)?.issue_type || 
                  memoizedIssueTypes?.find(pt => (pt.issue_type || pt).id === val) : 
                  undefined;
                if (onTypeChange) onTypeChange(selectedIssueType);
                if (handleFormChange) handleFormChange();
              }}
              projectId={projectId}
              disabled={disabled}
              placeholder={placeholder}
              dropdownArrow={renderChevron}
              buttonContainerClassName={dropDownContainerClassName}
              buttonVariant="border-with-text"
            />
          )}
        />
      </div>
    </div>
  </div>
  );
};