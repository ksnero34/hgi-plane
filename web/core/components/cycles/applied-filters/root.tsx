import { observer } from "mobx-react";
import { X } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TCycleFilters, TCustomField } from "@plane/types";
// hooks
import { Tag } from "@plane/ui";
import { AppliedDateFilters, AppliedStatusFilters } from "@/components/cycles";
import { AppliedCustomFieldFilters } from "@/components/issues";
import { replaceUnderscoreIfSnakeCase } from "@/helpers/string.helper";
import { useUserPermissions } from "@/hooks/store";

// components
// helpers
// types
// constants

type Props = {
  appliedFilters: TCycleFilters;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TCycleFilters, value: string | null) => void;
  alwaysAllowEditing?: boolean;
  customFields?: TCustomField[];
  workspaceSlug?: string;
  projectId?: string;
};

const DATE_FILTERS = ["start_date", "end_date"];

export const CycleAppliedFiltersList: React.FC<Props> = observer((props) => {
  const { appliedFilters, handleClearAllFilters, handleRemoveFilter, alwaysAllowEditing, customFields, workspaceSlug, projectId } = props;
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  if (!appliedFilters) return null;

  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed =
    alwaysAllowEditing ||
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof TCycleFilters) => {
    const filterLabels: Record<string, string> = {
      start_date: "시작일",
      end_date: "종료일",
      status: "상태",
      custom_fields: "커스텀 필드"
    };

    return filterLabels[key] || replaceUnderscoreIfSnakeCase(key);
  };

  return (
    <div className="flex flex-wrap items-stretch gap-2 bg-custom-background-100">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof TCycleFilters;

        if (!value) return;
        if (Array.isArray(value) && value.length === 0) return;

        // 커스텀 필드의 경우 별도 처리
        if (filterKey === "custom_fields" && customFields) {
          // 타입 안전성을 위한 검증
          let customFieldFilters: { [field_id: string]: string[] } = {};
          
          if (typeof value === 'string') {
            try {
              customFieldFilters = JSON.parse(value);
            } catch {
              return null; // JSON 파싱 실패 시 무시
            }
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            customFieldFilters = value as { [field_id: string]: string[] };
          } else {
            return null; // 예상하지 못한 타입인 경우 무시
          }
          
          return Object.entries(customFieldFilters).map(([fieldId, fieldValues]) => {
            if (!fieldValues || !Array.isArray(fieldValues) || fieldValues.length === 0) return null;
            
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
            <div className="flex flex-wrap items-center gap-1">
              {filterKey === "status" && (
                <AppliedStatusFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter("status", val)}
                  values={Array.isArray(value) ? value : []}
                />
              )}
              {DATE_FILTERS.includes(filterKey) && (
                <AppliedDateFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? value : []}
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
