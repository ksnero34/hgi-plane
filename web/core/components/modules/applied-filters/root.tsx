import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { TModuleDisplayFilters, TModuleFilters, TCustomField } from "@plane/types";
// components
import { Header, EHeaderVariant, Tag } from "@plane/ui";
import { AppliedDateFilters, AppliedMembersFilters, AppliedStatusFilters } from "@/components/modules";
import { AppliedCustomFieldFilters } from "@/components/issues";
// helpers
import { replaceUnderscoreIfSnakeCase } from "@/helpers/string.helper";
// types

type Props = {
  appliedFilters: TModuleFilters;
  isFavoriteFilterApplied?: boolean;
  handleClearAllFilters: () => void;
  handleDisplayFiltersUpdate?: (updatedDisplayProperties: Partial<TModuleDisplayFilters>) => void;
  handleRemoveFilter: (key: keyof TModuleFilters, value: string | null) => void;
  alwaysAllowEditing?: boolean;
  isArchived?: boolean;
  customFields?: TCustomField[];
  workspaceSlug?: string;
  projectId?: string;
};

const MEMBERS_FILTERS = ["lead", "members"];
const DATE_FILTERS = ["start_date", "target_date"];

export const ModuleAppliedFiltersList: React.FC<Props> = (props) => {
  const {
    appliedFilters,
    isFavoriteFilterApplied,
    handleClearAllFilters,
    handleRemoveFilter,
    handleDisplayFiltersUpdate,
    alwaysAllowEditing,
    isArchived = false,
    customFields,
    workspaceSlug,
    projectId,
  } = props;
  const { t } = useTranslation();

  if (!appliedFilters && !isFavoriteFilterApplied) return null;
  if (Object.keys(appliedFilters).length === 0 && !isFavoriteFilterApplied) return null;

  const isEditingAllowed = alwaysAllowEditing;

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof TModuleFilters) => {
    const filterLabels: Record<string, string> = {
      lead: "리더",
      members: "멤버",
      start_date: "시작일",
      target_date: "마감일",
      status: "상태",
      custom_fields: "커스텀 필드"
    };

    return filterLabels[key] || replaceUnderscoreIfSnakeCase(key);
  };

  return (
    <Header variant={EHeaderVariant.TERNARY}>
      <div className="flex gap-2 flex-wrap">
        {Object.entries(appliedFilters).map(([key, value]) => {
          const filterKey = key as keyof TModuleFilters;

          if (!value) return;
          if (Array.isArray(value) && value.length === 0) return;

          // 커스텀 필드의 경우 별도 처리
          if (filterKey === "custom_fields" && customFields) {
            const customFieldFilters = typeof value === 'string' ? JSON.parse(value) : value as { [field_id: string]: string[] };
            
            return Object.entries(customFieldFilters).map(([fieldId, fieldValues]) => {
              if (!fieldValues || !Array.isArray(fieldValues) || fieldValues.length === 0) return null;
              
              const field = customFields.find(f => f.id === fieldId);
              if (!field) return null;
              
              return (
                <Tag key={`${filterKey}-${fieldId}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-custom-text-300">{field.name}</span>
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
                        const newFieldValues = currentFieldValues.filter((v: string) => v !== val);
                        
                        const newCustomFieldFilters = {
                          ...currentCustomFieldFilters,
                          [fieldId]: newFieldValues.length > 0 ? newFieldValues : undefined
                        };
                        
                        // 빈 배열인 필드들 제거
                        Object.keys(newCustomFieldFilters).forEach(key => {
                          const fieldValues = newCustomFieldFilters[key];
                          if (!fieldValues || fieldValues.length === 0) {
                            delete newCustomFieldFilters[key];
                          }
                        });
                        
                        const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
                          ? JSON.stringify(newCustomFieldFilters) 
                          : null;
                        
                        handleRemoveFilter("custom_fields", customFieldsValue);
                      }}
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                    />
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
                  </div>
                </Tag>
              );
            }).filter(Boolean);
          }

          return (
            <Tag key={filterKey}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-custom-text-300">{getFilterKeyLabel(filterKey)}</span>
                {filterKey === "status" && (
                  <AppliedStatusFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter("status", val)}
                    values={value}
                  />
                )}
                {DATE_FILTERS.includes(filterKey) && (
                  <AppliedDateFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
                  />
                )}
                {MEMBERS_FILTERS.includes(filterKey) && (
                  <AppliedMembersFilters
                    editable={isEditingAllowed}
                    handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                    values={value}
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
              </div>
            </Tag>
          );
        })}
        {!isArchived && isFavoriteFilterApplied && (
          <div
            key="module_display_filters"
            className="flex flex-wrap items-center gap-2 rounded-md border border-custom-border-200 px-2 py-1 capitalize"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-custom-text-300">Modules</span>
              <div className="flex items-center gap-1 rounded p-1 text-xs bg-custom-background-80">
                Favorite
                {isEditingAllowed && (
                  <button
                    type="button"
                    className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                    onClick={() =>
                      handleDisplayFiltersUpdate &&
                      handleDisplayFiltersUpdate({
                        favorites: !isFavoriteFilterApplied,
                      })
                    }
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {isEditingAllowed && (
          <button type="button" onClick={handleClearAllFilters}>
            <Tag>
              {t("common.clear_all")}
              <X size={12} strokeWidth={2} />
            </Tag>
          </button>
        )}
      </div>
    </Header>
  );
};
