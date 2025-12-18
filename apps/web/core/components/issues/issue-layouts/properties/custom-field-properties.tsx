import React, { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { observer } from "mobx-react";
import { Tag, Tags, CalendarCheck2, UserCircle2, Users, Settings, MessageSquare } from "lucide-react";
// types
import type { TIssue, TCustomField, IIssueDisplayProperties } from "@plane/types";
// ui
import { Tooltip } from "@plane/ui";
// helpers
import { renderFormattedPayloadDate } from "@plane/utils";
import { updateCustomFieldValueSafely, getCustomFieldValue } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useMember } from "@/hooks/store/use-member";
// components
import { CustomFieldDropdown, DateDropdown, MemberDropdown } from "@/components/dropdowns";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";
import { cn } from "@plane/utils";

type Props = {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  isReadOnly: boolean;
  activeLayout: string;
  displayProperties: IIssueDisplayProperties | undefined;
  customFields?: TCustomField[];
};

export const IssueCustomFieldProperties: React.FC<Props> = observer((props) => {
  const { issue, updateIssue, isReadOnly, activeLayout, displayProperties, customFields = [] } = props;
  const { isMobile } = usePlatformOS();
  const { getUserDetails } = useMember();

  // text 필드의 로컬 상태 관리
  const [textFieldValues, setTextFieldValues] = useState<Record<string, string>>({});

  // MobX 반응성을 위해 computed 값 사용
  const customFieldValues = useMemo(() => {
    return issue?.custom_field_values || [];
  }, [issue?.custom_field_values, issue?.updated_at]); // updated_at을 의존성에 추가

  // Filter custom fields based on current issue type
  const filteredCustomFields = customFields.filter((field) => {
    // If custom field has no issue_type restriction, show for all issue types
    if (!field.issue_type) return true;
    // If issue has no type_id, don't show type-specific fields
    if (!issue?.type_id) return !field.issue_type;
    // Show only fields that match the current issue type
    return field.issue_type === issue.type_id;
  });

  if (!filteredCustomFields || filteredCustomFields.length === 0 || !displayProperties?.custom_fields) return null;

  // 특정 필드의 현재 값 가져오기
  const getFieldValue = (fieldId: string) => {
    return getCustomFieldValue(customFieldValues, fieldId);
  };

  // 커스텀 필드 값 업데이트 함수
  const updateFieldValue = (fieldId: string, value: any) => {
    if (!updateIssue || !issue?.project_id) return;

    const field = filteredCustomFields.find((f) => f.id === fieldId);
    if (!field) return;

    // 안전한 업데이트 함수 사용
    const updatedValues = updateCustomFieldValueSafely(customFieldValues, fieldId, value, {
      name: field.name,
      field_type: field.field_type,
    });

    updateIssue(issue.project_id, issue.id, {
      custom_field_values: updatedValues,
    });
  };

  // 필드 타입에 따른 아이콘 선택
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return MessageSquare;
      case "select":
        return Tag;
      case "multiselect":
        return Tags;
      case "date":
        return CalendarCheck2;
      case "project_member":
        return UserCircle2;
      case "project_members":
        return Users;
      default:
        return Settings;
    }
  };

  // 필드 값 포맷팅
  const formatFieldValue = (field: TCustomField, value: any) => {
    if (!value) return "";

    switch (field.field_type) {
      case "select":
        return value;
      case "multiselect":
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(", ") : "";
        }
        return value;
      case "date":
        return renderFormattedPayloadDate(value);
      case "project_member":
        if (value) {
          const member = getUserDetails(value);
          return member?.display_name || "알 수 없는 사용자";
        }
        return "";
      case "project_members":
        if (Array.isArray(value) && value.length > 0) {
          const memberNames = value
            .map((memberId) => {
              const member = getUserDetails(memberId);
              return member?.display_name || "알 수 없는 사용자";
            })
            .filter(Boolean);
          return memberNames.join(", ");
        }
        return "";
      default:
        return value;
    }
  };

  // 이벤트 전파 방지
  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // 필드 타입에 따른 입력 컴포넌트 렌더링
  const renderFieldDropdown = (field: TCustomField) => {
    const fieldValue = getFieldValue(field.id);
    const hasValue = fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    const FieldIcon = getFieldIcon(field.field_type);
    const formattedValue = formatFieldValue(field, fieldValue);

    switch (field.field_type) {
      case "text":
        const currentTextValue = textFieldValues[field.id] !== undefined ? textFieldValues[field.id] : fieldValue || "";

        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
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
                  updateFieldValue(field.id, value || null);
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
                updateFieldValue(field.id, value || null);
                // 로컬 상태 초기화
                setTextFieldValues((prev) => {
                  const newState = { ...prev };
                  delete newState[field.id];
                  return newState;
                });
              }}
              placeholder={field.name}
              disabled={isReadOnly}
              className={cn(
                "h-5 text-xs border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded flex items-center bg-transparent outline-none",
                hasValue ? "px-1.5 min-w-20" : "px-1.5 min-w-20 text-custom-text-400"
              )}
            />
          </div>
        );

      case "select":
      case "multiselect":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <CustomFieldDropdown
              field={field}
              value={fieldValue}
              onChange={(val: any) => updateFieldValue(field.id, val)}
              buttonVariant={hasValue ? "border-with-text" : "border-without-text"}
              className="h-5 min-w-5"
              buttonContainerClassName="h-5 min-w-5"
              buttonClassName={cn(
                "h-5 min-w-5 text-xs border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded flex items-center",
                hasValue ? "px-1.5" : "justify-center px-0"
              )}
              disabled={isReadOnly}
              showTooltip={true}
              dropdownArrow={false}
            />
          </div>
        );

      case "date":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <DateDropdown
              value={fieldValue}
              onChange={(date: Date | null) =>
                updateFieldValue(field.id, date ? renderFormattedPayloadDate(date) : null)
              }
              buttonVariant={hasValue ? "border-with-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName={cn(
                "h-5 text-xs border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 rounded flex items-center",
                hasValue ? "px-1.5" : "justify-center px-0 w-5"
              )}
              disabled={isReadOnly}
              showTooltip={true}
              icon={<FieldIcon className="h-3 w-3" />}
              hideIcon={hasValue}
              placeholder={field.name}
              renderByDefault={isMobile}
            />
          </div>
        );

      case "project_member":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <MemberDropdown
              projectId={issue.project_id ?? undefined}
              value={fieldValue || null}
              onChange={(val: string | null) => {
                // 기존 값과 같은 값을 선택하면 값을 제거
                const newValue = val === fieldValue ? null : val;
                updateFieldValue(field.id, newValue);
              }}
              multiple={false}
              buttonVariant={hasValue ? "transparent-without-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName={hasValue ? "hover:bg-transparent px-0" : ""}
              disabled={isReadOnly}
              showTooltip={true}
              tooltipContent={hasValue ? `${field.name}: ${formattedValue}` : field.name}
              placeholder={field.name}
              renderByDefault={isMobile}
            />
          </div>
        );

      case "project_members":
        return (
          <div className="h-5 flex items-center" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
            <MemberDropdown
              projectId={issue.project_id ?? undefined}
              value={Array.isArray(fieldValue) ? fieldValue : []}
              onChange={(val: string[]) => updateFieldValue(field.id, val && val.length > 0 ? val : null)}
              buttonVariant={hasValue ? "transparent-without-text" : "border-without-text"}
              className="h-5"
              buttonContainerClassName="h-5"
              buttonClassName={hasValue ? "hover:bg-transparent px-0" : ""}
              disabled={isReadOnly}
              multiple
              showTooltip={true}
              tooltipContent={hasValue ? `${field.name}: ${formattedValue}` : field.name}
              placeholder={field.name}
              renderByDefault={isMobile}
            />
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-5 w-5 rounded border-[0.5px] border-custom-border-300">
            <FieldIcon className="h-3 w-3" />
          </div>
        );
    }
  };

  return (
    <>
      {filteredCustomFields.map((field) => (
        <WithDisplayPropertiesHOC
          key={field.id}
          displayProperties={displayProperties}
          displayPropertyKey="custom_fields"
          shouldRenderProperty={() => true}
        >
          {renderFieldDropdown(field)}
        </WithDisplayPropertiesHOC>
      ))}
    </>
  );
});
