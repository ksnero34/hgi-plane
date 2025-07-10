import React from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { EViewAccess, TViewFilterProps, TCustomField } from "@plane/types";
// components
import { Tag } from "@plane/ui";
import { replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { AppliedDateFilters, AppliedMembersFilters } from "@/components/common/applied-filters";
import { AppliedCustomFieldFilters } from "@/components/issues";
// constants
// helpers
import { AppliedAccessFilters } from "./access";
import { prepareCustomFieldFiltersForRender, removeCustomFieldFilterValue, removeCustomFieldFilterField } from "@plane/utils";
// types

type Props = {
  appliedFilters: TViewFilterProps;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TViewFilterProps, value: string | EViewAccess | null) => void;
  alwaysAllowEditing?: boolean;
  customFields?: TCustomField[];
  workspaceSlug?: string;
  projectId?: string;
  isProjectLevel?: boolean;
  viewProjectId?: string;
};

const MEMBERS_FILTERS = ["owned_by"];
const DATE_FILTERS = ["created_at"];
const VIEW_ACCESS_FILTERS = ["view_type"];

export const ViewAppliedFiltersList: React.FC<Props> = observer((props) => {
  const {
    appliedFilters,
    handleClearAllFilters,
    handleRemoveFilter,
    alwaysAllowEditing,
    customFields,
    workspaceSlug,
    projectId,
    isProjectLevel,
    viewProjectId,
  } = props;
  const { t } = useTranslation();

  // 디버깅을 위한 콘솔로그 추가
  // console.log("ViewAppliedFiltersList - Component rendered");
  // console.log("ViewAppliedFiltersList - appliedFilters:", appliedFilters);
  // console.log("ViewAppliedFiltersList - customFields:", customFields?.length);
  // console.log("ViewAppliedFiltersList - isProjectLevel:", isProjectLevel);
  // console.log("ViewAppliedFiltersList - projectId:", projectId);
  // console.log("ViewAppliedFiltersList - viewProjectId:", viewProjectId);

  if (!appliedFilters) return null;
  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed = alwaysAllowEditing;
  const effectiveProjectId = isProjectLevel ? projectId : viewProjectId;

  // console.log("ViewAppliedFiltersList - effectiveProjectId:", effectiveProjectId);

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof TViewFilterProps) => {
    const filterLabels: Record<string, string> = {
      created_at: "생성일",
      owned_by: "소유자",
      favorites: "즐겨찾기",
      view_type: "접근 권한",
      custom_fields: "커스텀 필드"
    };

    return filterLabels[key] || replaceUnderscoreIfSnakeCase(key);
  };

  return (
    <div className="flex flex-wrap items-stretch gap-2 bg-custom-background-100">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof TViewFilterProps;

        if (!value) return;
        if (Array.isArray(value) && value.length === 0) return;

        // 커스텀 필드의 경우 새로운 헬퍼 함수 사용
        if (filterKey === "custom_fields" && customFields && isProjectLevel && effectiveProjectId) {
          const customFieldsForRender = prepareCustomFieldFiltersForRender(value as string, customFields);
          
          return customFieldsForRender.map(({ fieldId, field, fieldValues }) => (
            <Tag key={`${filterKey}-${fieldId}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-custom-text-300">{field.name}</span>
                <AppliedCustomFieldFilters
                  appliedFilters={{ [fieldId]: fieldValues }}
                  customFields={customFields}
                  editable={isEditingAllowed ?? false}
                  handleRemove={(fieldId, val) => {
                    const newValue = removeCustomFieldFilterValue(
                      typeof appliedFilters.custom_fields === 'string' 
                        ? appliedFilters.custom_fields 
                        : JSON.stringify(appliedFilters.custom_fields || {}),
                      fieldId,
                      val
                    );
                    handleRemoveFilter("custom_fields", newValue);
                  }}
                  workspaceSlug={workspaceSlug}
                  projectId={effectiveProjectId}
                />
                {isEditingAllowed && (
                  <button
                    type="button"
                    className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                    onClick={() => {
                      const newValue = removeCustomFieldFilterField(
                        typeof appliedFilters.custom_fields === 'string' 
                          ? appliedFilters.custom_fields 
                          : JSON.stringify(appliedFilters.custom_fields || {}),
                        fieldId
                      );
                      handleRemoveFilter("custom_fields", newValue);
                    }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            </Tag>
          ));
        }

        return (
          <Tag key={filterKey}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-custom-text-300">{getFilterKeyLabel(filterKey)}</span>
              {VIEW_ACCESS_FILTERS.includes(filterKey) && (
                <AppliedAccessFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? (value as EViewAccess[]) : []}
                />
              )}
              {DATE_FILTERS.includes(filterKey) && (
                <AppliedDateFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? (value as string[]) : []}
                />
              )}
              {MEMBERS_FILTERS.includes(filterKey) && (
                <AppliedMembersFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? (value as string[]) : []}
                />
              )}
              {filterKey === "favorites" && (
                <div className="flex items-center gap-1 rounded p-1 text-xs bg-custom-background-80">
                  {value === true ? "Favorite" : "Not Favorite"}
                  {isEditingAllowed && (
                    <button
                      type="button"
                      className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                      onClick={() => handleRemoveFilter("favorites", null)}
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}
              {(key === "access" && Array.isArray(value)) && (
                <div className="flex flex-wrap items-center gap-1">
                  {(value as EViewAccess[]).map((accessValue) => (
                    <div key={accessValue} className="flex items-center gap-1 rounded p-1 text-xs bg-custom-background-80">
                      {accessValue}
                      {isEditingAllowed && (
                        <button
                          type="button"
                          className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                          onClick={() => handleRemoveFilter("access" as keyof TViewFilterProps, accessValue)}
                        >
                          <X size={10} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isEditingAllowed && filterKey !== "favorites" && key !== "access" && (
                <button
                  type="button"
                  className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                  onClick={() => handleRemoveFilter(filterKey, null)}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          </Tag>
        );
      })}
      {isEditingAllowed && (
        <button type="button" onClick={handleClearAllFilters}>
          <Tag>
            {t("common.clear_all")}
            <X size={12} strokeWidth={2} />
          </Tag>
        </button>
      )}
    </div>
  );
});
