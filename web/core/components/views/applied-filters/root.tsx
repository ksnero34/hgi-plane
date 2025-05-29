import { X } from "lucide-react";
import { EViewAccess } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TViewFilterProps, TCustomField } from "@plane/types";
// components
import { Tag } from "@plane/ui";
import { AppliedDateFilters, AppliedMembersFilters } from "@/components/common/applied-filters";
import { AppliedCustomFieldFilters } from "@/components/issues";
// constants
// helpers
import { replaceUnderscoreIfSnakeCase } from "@/helpers/string.helper";
import { AppliedAccessFilters } from "./access";
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

export const ViewAppliedFiltersList: React.FC<Props> = (props) => {
  const { appliedFilters, handleClearAllFilters, handleRemoveFilter, alwaysAllowEditing, customFields, workspaceSlug, projectId, isProjectLevel = false, viewProjectId } = props;
  const { t } = useTranslation();

  if (!appliedFilters) return null;
  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed = alwaysAllowEditing;

  // 실제 사용할 projectId 결정
  const effectiveProjectId = isProjectLevel ? viewProjectId : projectId;

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

        // 커스텀 필드의 경우 별도 처리 - 프로젝트 레벨인 경우에만
        if (filterKey === "custom_fields" && customFields && isProjectLevel && effectiveProjectId) {
          const customFieldFilters = typeof value === 'string' ? JSON.parse(value) : value as { [field_id: string]: string[] };
          
          return Object.entries(customFieldFilters).map(([fieldId, fieldValues]) => {
            if (!fieldValues || fieldValues.length === 0) return null;
            
            const field = customFields.find(f => f.id === fieldId);
            if (!field) return null;
            
            return (
              <Tag key={`${filterKey}-${fieldId}`}>
                <span className="text-xs text-custom-text-300">{field.name}</span>
                <div className="flex flex-wrap items-center gap-1">
                  <AppliedCustomFieldFilters
                    appliedFilters={{ [fieldId]: fieldValues }}
                    customFields={customFields}
                    editable={isEditingAllowed}
                    handleRemove={(fieldId, val) => {
                      // 커스텀 필드 필터 제거 로직
                      const currentCustomFieldFilters = typeof appliedFilters.custom_fields === 'string' 
                        ? JSON.parse(appliedFilters.custom_fields) 
                        : appliedFilters.custom_fields || {};
                      const currentFieldValues = currentCustomFieldFilters[fieldId] || [];
                      const newFieldValues = currentFieldValues.filter(v => v !== val);
                      
                      const newCustomFieldFilters = {
                        ...currentCustomFieldFilters,
                        [fieldId]: newFieldValues.length > 0 ? newFieldValues : undefined
                      };
                      
                      // 빈 배열인 필드들 제거
                      Object.keys(newCustomFieldFilters).forEach(key => {
                        if (!newCustomFieldFilters[key] || newCustomFieldFilters[key].length === 0) {
                          delete newCustomFieldFilters[key];
                        }
                      });
                      
                      const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
                        ? JSON.stringify(newCustomFieldFilters) 
                        : null;
                      
                      handleRemoveFilter("custom_fields", customFieldsValue);
                    }}
                    workspaceSlug={workspaceSlug}
                    projectId={effectiveProjectId}
                  />
                </div>
                {isEditingAllowed && (
                  <button
                    type="button"
                    className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                    onClick={() => {
                      // 특정 필드의 모든 값 제거
                      const currentCustomFieldFilters = typeof appliedFilters.custom_fields === 'string' 
                        ? JSON.parse(appliedFilters.custom_fields) 
                        : appliedFilters.custom_fields || {};
                      
                      const newCustomFieldFilters = { ...currentCustomFieldFilters };
                      delete newCustomFieldFilters[fieldId];
                      
                      const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
                        ? JSON.stringify(newCustomFieldFilters) 
                        : null;
                      
                      handleRemoveFilter("custom_fields", customFieldsValue);
                    }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </Tag>
            );
          }).filter(Boolean);
        }

        return (
          <Tag key={filterKey}>
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
            {isEditingAllowed && (
              <button
                type="button"
                className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                onClick={() => handleRemoveFilter(filterKey, null)}
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
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
};
