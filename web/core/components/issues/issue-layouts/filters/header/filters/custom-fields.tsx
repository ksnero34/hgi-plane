"use client";

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import { Calendar, User, Users, Tag as TagIcon } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { TCustomField } from "@plane/types";
// components
import { FilterHeader, FilterOption } from "@/components/issues";
import { DateFilterModal } from "@/components/core";
import { Avatar } from "@plane/ui";
// hooks
import { useMember } from "@/hooks/store";
// helpers
import { getFileURL } from "@/helpers/file.helper";

type Props = {
  appliedFilters: { [field_id: string]: string[] } | null;
  handleUpdate: (fieldId: string, val: string) => void;
  searchQuery: string;
  customFields: TCustomField[];
  workspaceSlug: string;
  projectId: string;
};

export const FilterCustomFields: React.FC<Props> = observer((props) => {
  const { appliedFilters, handleUpdate, searchQuery, customFields, workspaceSlug, projectId } = props;
  // states
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  const [selectedDateField, setSelectedDateField] = useState<string | null>(null);
  const { t } = useTranslation();
  
  // hooks
  const {
    workspace: { getWorkspaceMemberDetails },
    project: { getProjectMemberDetails, fetchProjectMembers, getProjectMemberIds },
  } = useMember();

  // 프로젝트 멤버 데이터 fetch
  React.useEffect(() => {
    if (workspaceSlug && projectId) {
      fetchProjectMembers(workspaceSlug, projectId);
    }
  }, [workspaceSlug, projectId, fetchProjectMembers]);

  // 프로젝트 멤버 목록 가져오기
  const projectMemberIds = useMemo(() => {
    if (!workspaceSlug || !projectId) return [];
    return getProjectMemberIds(projectId, true) || [];
  }, [workspaceSlug, projectId, getProjectMemberIds]);

  const projectMembers = useMemo(() => {
    if (!projectMemberIds.length) return [];
    
    return projectMemberIds.map(memberId => {
      const memberDetails = getProjectMemberDetails(memberId, projectId);
      return memberDetails ? {
        id: memberId,
        name: memberDetails.member?.display_name || "Unknown",
        avatar: memberDetails.member?.avatar_url || null,
        email: memberDetails.member?.email || null,
      } : null;
    }).filter(Boolean);
  }, [projectMemberIds, getProjectMemberDetails, projectId]);

  // 검색어로 필터링된 커스텀 필드들
  const filteredCustomFields = useMemo(() => {
    if (!customFields || !Array.isArray(customFields)) return [];
    if (!searchQuery) return customFields;
    return customFields.filter((field) =>
      field.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customFields, searchQuery]);

  // 적용된 필터 개수 계산
  const appliedFiltersCount = useMemo(() => {
    if (!appliedFilters) return 0;
    return Object.values(appliedFilters).reduce((count, values) => count + (values?.length || 0), 0);
  }, [appliedFilters]);

  // 적용된 필터의 세부 정보를 생성하는 함수
  const getAppliedFiltersDetails = useMemo(() => {
    if (!appliedFilters || appliedFiltersCount === 0) return "";
    
    const details: string[] = [];
    Object.entries(appliedFilters).forEach(([fieldId, values]) => {
      if (!values || values.length === 0) return;
      
      // customFields가 undefined인 경우 처리
      if (!customFields || !Array.isArray(customFields)) return;
      
      const field = customFields.find(f => f.id === fieldId);
      if (!field) return;
      
      const fieldName = field.name;
      if (values.length === 1) {
        details.push(`${fieldName}: ${values[0]}`);
      } else {
        details.push(`${fieldName}: ${values.length}개 선택`);
      }
    });
    
    return details.length > 0 ? ` - ${details.join(", ")}` : "";
  }, [appliedFilters, appliedFiltersCount, customFields]);

  if (filteredCustomFields.length === 0) return null;

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
      case "multiselect":
        return <TagIcon className="h-3 w-3" />;
      case "date":
        return <Calendar className="h-3 w-3" />;
      case "project_member":
        return <User className="h-3 w-3" />;
      case "project_members":
        return <Users className="h-3 w-3" />;
      default:
        return <TagIcon className="h-3 w-3" />;
    }
  };

  const handleDateFilter = (fieldId: string) => {
    setSelectedDateField(fieldId);
    setIsDateFilterModalOpen(true);
  };

  const handleDateFilterSelect = (values: string | string[]) => {
    if (selectedDateField) {
      const valuesArray = Array.isArray(values) ? values : [values];
      valuesArray.forEach(value => handleUpdate(selectedDateField, value));
    }
    setIsDateFilterModalOpen(false);
    setSelectedDateField(null);
  };

  const isCustomDateSelected = (fieldId: string) => {
    const appliedValues = appliedFilters?.[fieldId] || [];
    return appliedValues.some(value => value.includes("-"));
  };

  const handleCustomDate = (fieldId: string) => {
    if (isCustomDateSelected(fieldId)) {
      // 커스텀 날짜 필터 제거
      const appliedValues = appliedFilters?.[fieldId] || [];
      const customDateValues = appliedValues.filter(value => value.includes("-"));
      customDateValues.forEach(value => handleUpdate(fieldId, value));
    } else {
      handleDateFilter(fieldId);
    }
  };

  return (
    <>
      {isDateFilterModalOpen && selectedDateField && (
        <DateFilterModal
          handleClose={() => {
            setIsDateFilterModalOpen(false);
            setSelectedDateField(null);
          }}
          isOpen={isDateFilterModalOpen}
          onSelect={handleDateFilterSelect}
          title={customFields?.find(f => f.id === selectedDateField)?.name || "날짜 필터"}
        />
      )}
      <FilterHeader
        title={`커스텀 필드${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""} ${getAppliedFiltersDetails}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredCustomFields.map((field) => {
            // Select/Multiselect 필드
            if (field.field_type === "select" || field.field_type === "multiselect") {
              return (
                <div key={field.id} className="mb-2">
                  <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                    {getFieldIcon(field.field_type)}
                    {field.name}
                  </div>
                  {field.options?.map((option) => (
                    <FilterOption
                      key={`${field.id}-${option}`}
                      isChecked={appliedFilters?.[field.id]?.includes(option) || false}
                      onClick={() => {
                        // console.log("FilterCustomFields - onClick:", field.id, option);
                        // console.log("FilterCustomFields - current appliedFilters:", appliedFilters);
                        handleUpdate(field.id, option);
                      }}
                      title={option}
                    />
                  ))}
                </div>
              );
            }
            
            // 날짜 필드
            if (field.field_type === "date") {
              const dateFilterOptions = [
                { value: "1_weeks;within;fromnow", name: "다음 1주일" },
                { value: "2_weeks;within;fromnow", name: "다음 2주일" },
                { value: "1_months;within;fromnow", name: "다음 1개월" },
                { value: "2_months;within;fromnow", name: "다음 2개월" },
                { value: "1_weeks;before", name: "지난 1주일" },
                { value: "2_weeks;before", name: "지난 2주일" },
                { value: "1_months;before", name: "지난 1개월" },
                { value: "2_months;before", name: "지난 2개월" },
              ];

              return (
                <div key={field.id} className="mb-2">
                  <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                    {getFieldIcon(field.field_type)}
                    {field.name}
                  </div>
                  {dateFilterOptions.map((option) => (
                    <FilterOption
                      key={`${field.id}-${option.value}`}
                      isChecked={appliedFilters?.[field.id]?.includes(option.value) || false}
                      onClick={() => handleUpdate(field.id, option.value)}
                      title={option.name}
                      multiple
                    />
                  ))}
                  <FilterOption
                    isChecked={isCustomDateSelected(field.id)}
                    onClick={() => handleCustomDate(field.id)}
                    title="사용자 정의"
                    multiple
                  />
                </div>
              );
            }

            // 프로젝트 멤버 필드 (단일 선택)
            if (field.field_type === "project_member") {
              return (
                <div key={field.id} className="mb-2">
                  <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                    {getFieldIcon(field.field_type)}
                    {field.name}
                  </div>
                  {projectMembers.length > 0 ? (
                    projectMembers
                      .filter((member): member is NonNullable<typeof member> => member !== null)
                      .map((member) => (
                        <FilterOption
                          key={`${field.id}-${member.id}`}
                          isChecked={appliedFilters?.[field.id]?.includes(member.id) || false}
                          onClick={() => handleUpdate(field.id, member.id)}
                          icon={
                            <Avatar
                              name={member.name}
                              src={getFileURL(member.avatar ?? "")}
                              showTooltip={false}
                              size="md"
                            />
                          }
                          title={member.name}
                        />
                      ))
                  ) : (
                    <div className="text-xs text-custom-text-400 italic ml-4">
                      프로젝트 멤버를 불러오는 중...
                    </div>
                  )}
                </div>
              );
            }

            // 프로젝트 멤버들 필드 (다중 선택)
            if (field.field_type === "project_members") {
              return (
                <div key={field.id} className="mb-2">
                  <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                    {getFieldIcon(field.field_type)}
                    {field.name}
                  </div>
                  {projectMembers.length > 0 ? (
                    projectMembers
                      .filter((member): member is NonNullable<typeof member> => member !== null)
                      .map((member) => (
                        <FilterOption
                          key={`${field.id}-${member.id}`}
                          isChecked={appliedFilters?.[field.id]?.includes(member.id) || false}
                          onClick={() => handleUpdate(field.id, member.id)}
                          icon={
                            <Avatar
                              name={member.name}
                              src={getFileURL(member.avatar ?? "")}
                              showTooltip={false}
                              size="md"
                            />
                          }
                          title={member.name}
                          multiple
                        />
                      ))
                  ) : (
                    <div className="text-xs text-custom-text-400 italic ml-4">
                      프로젝트 멤버를 불러오는 중...
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
          {filteredCustomFields.length === 0 && (
            <p className="text-xs italic text-custom-text-400">일치하는 항목 없음</p>
          )}
        </div>
      )}
    </>
  );
}); 