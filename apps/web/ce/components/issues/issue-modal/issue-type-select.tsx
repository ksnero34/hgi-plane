import React from "react";
import { Control, Controller } from "react-hook-form";
// plane imports
import { EditorRefApi } from "@plane/editor";
// types
import { TBulkIssueProperties, TIssue } from "@plane/types";
// components
import { IssueTypeDropdown } from "@/components/dropdowns";

export type TIssueFields = TIssue & TBulkIssueProperties;

export type TIssueTypeDropdownVariant = "xs" | "sm";

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
};

export const IssueTypeSelect = <T extends Partial<TIssueFields>>({
  control,
  projectId,
  disabled = false,
  placeholder = "Select issue type",
  renderChevron = true,
  dropDownContainerClassName,
  handleFormChange,
}: TIssueTypeSelectProps<T>) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 flex-shrink-0">
        <span className="text-[12px] text-custom-text-300">#</span>
      </div>
      <div className="flex-grow">
        <Controller
          control={control}
          name="type_id" as keyof T
          render={({ field: { onChange, value } }) => (
            <IssueTypeDropdown
              value={value}
              onChange={(val) => {
                onChange(val);
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