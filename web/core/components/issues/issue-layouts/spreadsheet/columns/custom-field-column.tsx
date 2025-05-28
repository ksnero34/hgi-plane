"use client";

import React, { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { Tag, Tags, CalendarCheck2, UserCircle2, Users, Settings } from "lucide-react";
// types
import { TIssue, TCustomField } from "@plane/types";
// components
import { CustomFieldDropdown, DateDropdown, MemberDropdown } from "@/components/dropdowns";
// ui
import { Tooltip } from "@plane/ui";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// helpers
import { cn } from "@/helpers/common.helper";

type Props = {
  issue: TIssue;
  customField: TCustomField;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
  onClose: () => void;
};

export const SpreadsheetCustomFieldColumn: React.FC<Props> = observer((props) => {
  const { issue, customField, onChange, disabled, onClose } = props;
  const { isMobile } = usePlatformOS();

  // 해당 커스텀 필드의 현재 값 가져오기
  const getFieldValue = () => {
    const fieldValue = issue?.custom_field_values?.find(cfv => cfv.custom_field_id === customField.id);
    return fieldValue?.value;
  };

  // 커스텀 필드 값 업데이트
  const updateFieldValue = (value: any) => {
    const currentValues = issue?.custom_field_values || [];
    const updatedValues = [...currentValues];
    
    // 해당 필드의 값이 이미 있는지 확인
    const existingIndex = updatedValues.findIndex(cfv => cfv.custom_field_id === customField.id);
    
    if (existingIndex >= 0) {
      // 기존 값 업데이트 또는 제거
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
        updatedValues.splice(existingIndex, 1);
      } else {
        updatedValues[existingIndex] = {
          ...updatedValues[existingIndex],
          value: value
        };
      }
    } else if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      // 새 값 추가
      updatedValues.push({
        custom_field_id: customField.id,
        value: value
      });
    }

    // 이슈 업데이트
    onChange(issue, { custom_field_values: updatedValues }, {});
  };

  const fieldValue = getFieldValue();

  // 필드 타입에 따른 아이콘 가져오기
  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
        return <Tag className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "multiselect":
        return <Tags className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "date":
        return <CalendarCheck2 className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "project_member":
        return <UserCircle2 className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "project_members":
        return <Users className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      default:
        return <Settings className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
    }
  };

  const clickableAreaBaseClass = "flex h-full w-full cursor-pointer items-center gap-1.5 rounded-none px-page-x py-1 text-xs hover:bg-custom-background-80 group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10";

  // select/multiselect 타입을 위한 컴포넌트들 (라벨 컴포넌트와 동일한 패턴)
  const NoValue = useMemo(
    () => (
      <Tooltip
        position="top"
        tooltipHeading={customField.name}
        tooltipContent="None"
        isMobile={isMobile}
        renderByDefault={false}
      >
        <div className={cn(clickableAreaBaseClass, "text-custom-text-400")}>
          {getFieldIcon(customField.field_type)}
          <span className="truncate">{customField.name}</span>
        </div>
      </Tooltip>
    ),
    [customField, isMobile, clickableAreaBaseClass]
  );

  const SelectSummary = useMemo(
    () => (
      <Tooltip
        isMobile={isMobile}
        position="top"
        tooltipHeading={customField.name}
        tooltipContent={Array.isArray(fieldValue) ? fieldValue.join(", ") : fieldValue}
        renderByDefault={false}
      >
        <div className={cn(clickableAreaBaseClass, "text-custom-text-200")}>
          {getFieldIcon(customField.field_type)}
          <span className="truncate">
            {Array.isArray(fieldValue) ? `${fieldValue.length} selected` : fieldValue}
          </span>
        </div>
      </Tooltip>
    ),
    [customField, fieldValue, isMobile, clickableAreaBaseClass]
  );

  const SelectItem = useCallback(
    ({ value }: { value: string }) => (
      <Tooltip
        key={value}
        position="top"
        tooltipHeading={customField.name}
        tooltipContent={value}
        isMobile={isMobile}
        renderByDefault={false}
      >
        <div className={cn(clickableAreaBaseClass, "text-custom-text-200")}>
          {getFieldIcon(customField.field_type)}
          <span className="truncate">{value}</span>
        </div>
      </Tooltip>
    ),
    [customField, isMobile, clickableAreaBaseClass]
  );

  // 필드 타입에 따른 입력 컴포넌트 렌더링
  const renderFieldInput = () => {
    const buttonClassName = "text-left rounded-none group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10 px-page-x w-full h-full";

    switch (customField.field_type) {
      case "select":
        const hasSelectValue = fieldValue && fieldValue !== "";
        
        if (!hasSelectValue) {
          return (
            <CustomFieldDropdown
              field={customField}
              value={fieldValue}
              onChange={updateFieldValue}
              disabled={disabled}
              onClose={onClose}
              buttonVariant="transparent-without-text"
              buttonContainerClassName="w-full h-full"
              buttonClassName={buttonClassName}
              hideDropdownArrow
              fullWidth
              fullHeight
              button={NoValue}
            />
          );
        }

        return (
          <CustomFieldDropdown
            field={customField}
            value={fieldValue}
            onChange={updateFieldValue}
            disabled={disabled}
            onClose={onClose}
            buttonVariant="transparent-without-text"
            buttonContainerClassName="w-full h-full"
            buttonClassName={buttonClassName}
            hideDropdownArrow
            fullWidth
            fullHeight
            button={<SelectItem value={fieldValue} />}
          />
        );

      case "multiselect":
        const selectedValues = Array.isArray(fieldValue) ? fieldValue : [];
        const hasMultiSelectValue = selectedValues.length > 0;
        const maxRender = 1; // 스프레드시트에서는 1개만 표시

        if (!hasMultiSelectValue) {
          return (
            <CustomFieldDropdown
              field={customField}
              value={fieldValue}
              onChange={updateFieldValue}
              disabled={disabled}
              onClose={onClose}
              buttonVariant="transparent-without-text"
              buttonContainerClassName="w-full h-full"
              buttonClassName={buttonClassName}
              hideDropdownArrow
              fullWidth
              fullHeight
              button={NoValue}
            />
          );
        }

        // 라벨 컴포넌트와 동일한 패턴: 개수에 따라 조건부 렌더링
        if (selectedValues.length <= maxRender) {
          return (
            <CustomFieldDropdown
              field={customField}
              value={fieldValue}
              onChange={updateFieldValue}
              disabled={disabled}
              onClose={onClose}
              buttonVariant="transparent-without-text"
              buttonContainerClassName="w-full h-full"
              buttonClassName={buttonClassName}
              hideDropdownArrow
              fullWidth
              fullHeight
              button={<SelectItem value={selectedValues[0]} />}
            />
          );
        }

        return (
          <CustomFieldDropdown
            field={customField}
            value={fieldValue}
            onChange={updateFieldValue}
            disabled={disabled}
            onClose={onClose}
            buttonVariant="transparent-without-text"
            buttonContainerClassName="w-full h-full"
            buttonClassName={buttonClassName}
            hideDropdownArrow
            fullWidth
            fullHeight
            button={SelectSummary}
          />
        );

      case "date":
        return (
          <DateDropdown
            value={fieldValue}
            onChange={updateFieldValue}
            buttonVariant="transparent-with-text"
            buttonClassName={buttonClassName}
            buttonContainerClassName="w-full"
            disabled={disabled}
            placeholder={customField.name}
            onClose={onClose}
          />
        );

      case "project_member":
        return (
          <MemberDropdown
            projectId={issue.project_id}
            value={fieldValue}
            onChange={updateFieldValue}
            buttonVariant="transparent-with-text"
            buttonClassName={buttonClassName}
            buttonContainerClassName="w-full"
            disabled={disabled}
            placeholder={customField.name}
            onClose={onClose}
          />
        );

      case "project_members":
        return (
          <MemberDropdown
            projectId={issue.project_id}
            value={fieldValue}
            onChange={updateFieldValue}
            buttonVariant="transparent-with-text"
            buttonClassName={buttonClassName}
            buttonContainerClassName="w-full"
            disabled={disabled}
            multiple
            placeholder={customField.name}
            onClose={onClose}
          />
        );

      default:
        return (
          <div className="h-full w-full flex items-center px-page-x py-1 text-xs text-custom-text-400">
            {fieldValue || "값 없음"}
          </div>
        );
    }
  };

  return (
    <div className="h-11 border-b-[0.5px] border-custom-border-200">
      {renderFieldInput()}
    </div>
  );
});

// 개별 커스텀 필드 컬럼 컴포넌트 (issue-column.tsx에서 사용)
interface ICustomFieldColumn {
  issue: TIssue;
  customField: TCustomField;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
  onClose: () => void;
}

export const CustomFieldColumn: React.FC<ICustomFieldColumn> = observer((props) => {
  return <SpreadsheetCustomFieldColumn {...props} />;
});

// 통합 커스텀 필드 컬럼 컴포넌트 (SPREADSHEET_COLUMNS에서 사용)
interface IAllCustomFieldsColumn {
  issue: TIssue;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
  onClose: () => void;
}

export const AllCustomFieldsColumn: React.FC<IAllCustomFieldsColumn> = observer((props) => {
  const { issue, onChange, disabled, onClose } = props;
  const { isMobile } = usePlatformOS();

  // 이슈의 모든 커스텀 필드 값들
  const customFieldValues = issue?.custom_field_values || [];
  
  // 값이 있는 커스텀 필드들만 표시
  const hasValues = customFieldValues.length > 0;
  const maxRender = 1; // 스프레드시트에서는 1개만 표시

  // 필드 타입에 따른 아이콘 가져오기
  const getFieldIcon = () => {
    return <Settings className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
  };

  // 값이 없을 때 표시할 컴포넌트
  const NoValue = useMemo(
    () => (
      <Tooltip
        position="top"
        tooltipHeading="커스텀 필드"
        tooltipContent="None"
        isMobile={isMobile}
        renderByDefault={false}
      >
        <div className="flex h-full items-center gap-1.5 rounded-none px-page-x py-1 text-xs hover:bg-custom-background-80 group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10 w-full cursor-pointer">
          {getFieldIcon()}
          <span className="text-custom-text-400 truncate">커스텀 필드</span>
        </div>
      </Tooltip>
    ),
    [isMobile]
  );

  // 요약 표시 컴포넌트
  const Summary = useMemo(
    () => (
      <Tooltip
        position="top"
        tooltipHeading="커스텀 필드"
        tooltipContent={`${customFieldValues.length}개 설정됨`}
        isMobile={isMobile}
        renderByDefault={false}
      >
        <div className="flex h-full items-center gap-1.5 rounded-none px-page-x py-1 text-xs hover:bg-custom-background-80 group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10 w-full cursor-pointer">
          {getFieldIcon()}
          <span className="text-custom-text-200 truncate">
            {customFieldValues.length}개 설정됨
          </span>
        </div>
      </Tooltip>
    ),
    [customFieldValues.length, isMobile]
  );

  if (!hasValues) {
    return (
      <div className="h-11 border-b-[0.5px] border-custom-border-200">
        {NoValue}
      </div>
    );
  }

  if (customFieldValues.length <= maxRender) {
    // 첫 번째 값만 표시
    const firstValue = customFieldValues[0];
    return (
      <div className="h-11 border-b-[0.5px] border-custom-border-200">
        <Tooltip
          position="top"
          tooltipHeading="커스텀 필드"
          tooltipContent={`${firstValue.value}`}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <div className="flex h-full items-center gap-1.5 rounded-none px-page-x py-1 text-xs hover:bg-custom-background-80 group-[.selected-issue-row]:bg-custom-primary-100/5 group-[.selected-issue-row]:hover:bg-custom-primary-100/10 w-full cursor-pointer">
            {getFieldIcon()}
            <span className="text-custom-text-200 truncate">
              {Array.isArray(firstValue.value) ? firstValue.value.join(", ") : firstValue.value}
            </span>
          </div>
        </Tooltip>
      </div>
    );
  }

  // 여러 개일 때 요약 표시
  return (
    <div className="h-11 border-b-[0.5px] border-custom-border-200">
      {Summary}
    </div>
  );
}); 