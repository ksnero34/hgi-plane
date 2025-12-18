import { useState } from "react";
import type { FC } from "react";
import { observer } from "mobx-react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
// types
import type { TIssue, TCustomField } from "@plane/types";
// ui
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";
// services
import { renderFormattedPayloadDate } from "@plane/utils";
import { useCustomField } from "@/hooks/store/use-custom-field";

type Props = {
  control: Control<TIssue>;
  projectId: string;
  workspaceSlug: string;
  handleFormChange: () => void;
  issueTypeId?: string | null;
};

export const IssueCustomField: FC<Props> = observer((props) => {
  const { control, projectId, workspaceSlug, handleFormChange, issueTypeId } = props;
  const { t } = useTranslation();

  const { customFields, isLoading } = useCustomField(projectId);
  const [textFieldValues, setTextFieldValues] = useState<{ [key: string]: string }>({});

  const renderFieldInput = (field: TCustomField, value: any, onChange: (value: any) => void) => {
    const fieldValue = value?.value;

    const currentTextValue = textFieldValues[field.id] ?? fieldValue ?? "";

    switch (field.field_type) {
      case "text":
        return (
          <input
            type="text"
            value={currentTextValue}
            onChange={(e) => {
              // 로컬 상태만 업데이트 (UI 반응성)
              setTextFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.value,
              }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // 엔터키로 업데이트했음을 먼저 표시
                e.currentTarget.dataset.updatedByEnter = "true";
                const value = e.currentTarget.value.trim();
                onChange({
                  custom_field_id: field.id,
                  value: value || null,
                });
                handleFormChange();
                e.currentTarget.blur();
                // 로컬 상태 초기화
                setTextFieldValues((prev) => {
                  const newState = { ...prev };
                  delete newState[field.id];
                  return newState;
                });
              }
            }}
            onBlur={(e) => {
              // 엔터키로 이미 업데이트했다면 onBlur에서는 실행하지 않음
              if (e.currentTarget.dataset.updatedByEnter === "true") {
                e.currentTarget.dataset.updatedByEnter = "false";
                return;
              }
              const value = e.currentTarget.value.trim();
              onChange({
                custom_field_id: field.id,
                value: value || null,
              });
              handleFormChange();
              // 로컬 상태 초기화
              setTextFieldValues((prev) => {
                const newState = { ...prev };
                delete newState[field.id];
                return newState;
              });
            }}
            placeholder={field.name}
            className="w-full px-3 py-2 text-sm border border-custom-border-200 rounded-md bg-transparent text-custom-text-200 placeholder:text-custom-text-400 focus:outline-none focus:border-custom-primary-100"
          />
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={(date) => {
              const formattedDate = date ? renderFormattedPayloadDate(date) : null;
              onChange({
                custom_field_id: field.id,
                value: formattedDate,
              });
              handleFormChange();
            }}
            placeholder="날짜 선택"
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            clearIconClassName="h-3 w-3 hidden group-hover:inline"
          />
        );

      case "select":
      case "multiselect":
        return (
          <CustomFieldDropdown
            field={field}
            value={fieldValue}
            onChange={(val: any) => {
              onChange({
                custom_field_id: field.id,
                value: val,
              });
              handleFormChange();
            }}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            placeholder={field.name}
            showFieldNameWhenEmpty={true}
            dropdownArrow
            dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string | null) => {
              // 같은 값을 다시 클릭하면 값을 제거 (토글 기능)
              const newValue = fieldValue === val ? null : val;
              onChange({
                custom_field_id: field.id,
                value: newValue,
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            showUserDetails={true}
            multiple={false}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            value={fieldValue}
            onChange={(val: string[]) => {
              onChange({
                custom_field_id: field.id,
                value: val,
              });
              handleFormChange();
            }}
            projectId={projectId}
            placeholder={`${field.name} 선택`}
            buttonVariant="border-with-text"
            className="w-full group"
            buttonContainerClassName="w-full text-left"
            buttonClassName="text-sm"
            showUserDetails={true}
            multiple
          />
        );

      default:
        return (
          <div className="w-full">
            <div className="w-full h-full flex items-center gap-1.5 rounded border border-custom-border-300 px-2 py-0.5 text-sm justify-between cursor-not-allowed">
              <span className="flex-grow truncate text-xs leading-5 text-custom-text-400">지원하지 않는 필드 타입</span>
            </div>
          </div>
        );
    }
  };

  if (isLoading) return <div>{t("common.loading")}</div>;

  const filteredCustomFields = customFields.filter((field) => field.issue_type === null);

  return (
    <>
      {filteredCustomFields.map((field) => (
        <Controller
          key={field.id}
          control={control}
          name={`custom_field_values.${field.id}` as any}
          render={({ field: formField }) => (
            <div className="h-7 flex items-center">
              {renderFieldInput(field, formField.value, formField.onChange)}
              {field.is_required && <span className="text-red-500 ml-1 text-xs">*</span>}
            </div>
          )}
        />
      ))}
    </>
  );
});
