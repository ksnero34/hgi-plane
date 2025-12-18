import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import { Calendar, User, Users, Tag as TagIcon } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import type { TCustomField } from "@plane/types";
// components
import { FilterHeader, FilterOption } from "../helpers";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { Avatar } from "@plane/ui";
// hooks
import { useMember } from "@/hooks/store/use-member";
// helpers
import { getFileURL } from "@plane/utils";

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

  // console.log("FilterCustomFields - Received props:");
  // console.log("FilterCustomFields - customFields:", customFields);
  // console.log("FilterCustomFields - customFields length:", customFields?.length);
  // console.log("FilterCustomFields - workspaceSlug:", workspaceSlug);
  // console.log("FilterCustomFields - projectId:", projectId);

  // states
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  const [selectedDateField, setSelectedDateField] = useState<string | null>(null);
  const [memberFieldsToRender, setMemberFieldsToRender] = useState<{ [fieldId: string]: number }>({});
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

    return projectMemberIds
      .map((memberId) => {
        const memberDetails = getProjectMemberDetails(memberId, projectId);
        return memberDetails
          ? {
              id: memberId,
              name: memberDetails.member?.display_name || memberDetails.member?.first_name || "Unknown",
              avatar: memberDetails.member?.avatar_url || null,
              email: memberDetails.member?.email || null,
            }
          : null;
      })
      .filter(Boolean);
  }, [projectMemberIds, getProjectMemberDetails, projectId]);

  // 검색어로 필터링된 커스텀 필드들
  const filteredCustomFields = useMemo(() => {
    if (!customFields || !Array.isArray(customFields)) return [];
    if (!searchQuery) return customFields;
    return customFields.filter((field) => field.name.toLowerCase().includes(searchQuery.toLowerCase()));
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

      const field = customFields.find((f) => f.id === fieldId);
      if (!field) return;

      const fieldName = field.name;

      // project_member나 project_members 필드인 경우 UUID를 멤버 이름으로 변환
      if (field.field_type === "project_member" || field.field_type === "project_members") {
        if (values.length === 1) {
          const memberDetails = getProjectMemberDetails(values[0], projectId);
          const displayName =
            memberDetails?.member?.display_name ||
            memberDetails?.member?.first_name ||
            memberDetails?.member?.email ||
            `${values[0].substring(0, 8)}...`;
          details.push(`${fieldName}: ${displayName}`);
        } else {
          details.push(`${fieldName}: ${values.length}개 선택`);
        }
      } else {
        // 다른 필드 타입의 경우 기존 로직 유지
        if (values.length === 1) {
          details.push(`${fieldName}: ${values[0]}`);
        } else {
          details.push(`${fieldName}: ${values.length}개 선택`);
        }
      }
    });

    return details.length > 0 ? ` - ${details.join(", ")}` : "";
  }, [appliedFilters, appliedFiltersCount, customFields, getProjectMemberDetails, projectId]);

  // 커스텀 필드가 없어도 헤더는 표시
  const shouldShowHeader = customFields && customFields.length > 0;

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return <TagIcon className="h-3 w-3" />;
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
      valuesArray.forEach((value) => handleUpdate(selectedDateField, value));
    }
    setIsDateFilterModalOpen(false);
    setSelectedDateField(null);
  };

  const isCustomDateSelected = (fieldId: string) => {
    const appliedValues = appliedFilters?.[fieldId] || [];
    return appliedValues.some((value) => value.includes("-"));
  };

  const handleCustomDate = (fieldId: string) => {
    if (isCustomDateSelected(fieldId)) {
      // 커스텀 날짜 필터 제거
      const appliedValues = appliedFilters?.[fieldId] || [];
      const customDateValues = appliedValues.filter((value) => value.includes("-"));
      customDateValues.forEach((value) => handleUpdate(fieldId, value));
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
          title={customFields?.find((f) => f.id === selectedDateField)?.name || "날짜 필터"}
        />
      )}
      <FilterHeader
        title={`커스텀 필드${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""} ${getAppliedFiltersDetails}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredCustomFields.length > 0 ? (
            filteredCustomFields.map((field) => {
              // Text 필드 - 검색 입력 필드
              if (field.field_type === "text") {
                return (
                  <div key={field.id} className="mb-2">
                    <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                      {getFieldIcon(field.field_type)}
                      {field.name}
                    </div>
                    <div className="px-2">
                      <input
                        type="text"
                        placeholder="검색어 입력..."
                        className="w-full px-2 py-1 text-xs border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value) {
                              handleUpdate(field.id, value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }
                        }}
                      />
                      {appliedFilters?.[field.id] && appliedFilters[field.id].length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {appliedFilters[field.id].map((value, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-custom-background-80 text-custom-text-200 rounded cursor-pointer hover:bg-custom-background-90"
                              onClick={() => handleUpdate(field.id, value)}
                            >
                              {value}
                              <span className="text-custom-text-400">×</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

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
                const itemsToRender = memberFieldsToRender[field.id] || 5;
                const membersToShow = projectMembers.slice(0, itemsToRender);
                const hasMore = projectMembers.length > itemsToRender;

                return (
                  <div key={field.id} className="mb-2">
                    <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                      {getFieldIcon(field.field_type)}
                      {field.name}
                    </div>
                    {projectMembers.length > 0 ? (
                      <>
                        {membersToShow
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
                          ))}
                        {projectMembers.length > 5 && (
                          <button
                            type="button"
                            className="ml-8 text-xs font-medium text-custom-primary-100 hover:underline"
                            onClick={() => {
                              if (hasMore) {
                                setMemberFieldsToRender({
                                  ...memberFieldsToRender,
                                  [field.id]: projectMembers.length,
                                });
                              } else {
                                setMemberFieldsToRender({
                                  ...memberFieldsToRender,
                                  [field.id]: 5,
                                });
                              }
                            }}
                          >
                            {hasMore ? "모두 보기" : "줄여서 보기"}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-custom-text-400 italic ml-4">
                        {projectMemberIds.length === 0 ? "프로젝트 멤버가 없습니다" : "프로젝트 멤버를 불러오는 중..."}
                      </div>
                    )}
                  </div>
                );
              }

              // 프로젝트 멤버들 필드 (다중 선택)
              if (field.field_type === "project_members") {
                const itemsToRender = memberFieldsToRender[field.id] || 5;
                const membersToShow = projectMembers.slice(0, itemsToRender);
                const hasMore = projectMembers.length > itemsToRender;

                return (
                  <div key={field.id} className="mb-2">
                    <div className="text-xs font-medium text-custom-text-300 mb-1 flex items-center gap-1">
                      {getFieldIcon(field.field_type)}
                      {field.name}
                    </div>
                    {projectMembers.length > 0 ? (
                      <>
                        {membersToShow
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
                          ))}
                        {projectMembers.length > 5 && (
                          <button
                            type="button"
                            className="ml-8 text-xs font-medium text-custom-primary-100 hover:underline"
                            onClick={() => {
                              if (hasMore) {
                                setMemberFieldsToRender({
                                  ...memberFieldsToRender,
                                  [field.id]: projectMembers.length,
                                });
                              } else {
                                setMemberFieldsToRender({
                                  ...memberFieldsToRender,
                                  [field.id]: 5,
                                });
                              }
                            }}
                          >
                            {hasMore ? "모두 보기" : "줄여서 보기"}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-custom-text-400 italic ml-4">
                        {projectMemberIds.length === 0 ? "프로젝트 멤버가 없습니다" : "프로젝트 멤버를 불러오는 중..."}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })
          ) : (
            <p className="text-xs italic text-custom-text-400">
              {customFields && customFields.length === 0 ? "커스텀 필드가 없습니다" : "일치하는 항목 없음"}
            </p>
          )}
        </div>
      )}
    </>
  );
});
