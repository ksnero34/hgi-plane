import React from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TCycleFilters, TCycleDisplayFilters, TCustomField } from "@plane/types";
// hooks
import { Tag } from "@plane/ui";
import { AppliedDateFilters, AppliedStatusFilters } from "@/components/cycles";
import { AppliedCustomFieldFilters, AppliedMembersFilters } from "@/components/issues";
import { replaceUnderscoreIfSnakeCase } from "@/helpers/string.helper";
import { useUserPermissions } from "@/hooks/store";
import { prepareCustomFieldFiltersForRender, removeCustomFieldFilterValue, removeCustomFieldFilterField } from "@/helpers/custom-field.helper";

// components
// helpers
// types
// constants

type Props = {
  appliedFilters: TCycleFilters;
  isFavoriteFilterApplied: boolean;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TCycleFilters, value: string | null) => void;
  handleDisplayFiltersUpdate?: (filters: Partial<TCycleDisplayFilters>) => void;
  alwaysAllowEditing?: boolean;
  customFields?: TCustomField[];
  workspaceSlug?: string;
  projectId?: string;
  isArchived?: boolean;
};

const DATE_FILTERS = ["start_date", "end_date"];
const MEMBERS_FILTERS = ["members"];

export const CycleAppliedFiltersList: React.FC<Props> = observer((props) => {
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
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  if (!appliedFilters && !isFavoriteFilterApplied) return null;
  if (Object.keys(appliedFilters).length === 0 && !isFavoriteFilterApplied) return null;

  const isEditingAllowed =
    alwaysAllowEditing ||
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof TCycleFilters) => {
    const filterLabels: Record<string, string> = {
      lead: "리더",
      members: "멤버",
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

        // 커스텀 필드의 경우 새로운 헬퍼 함수 사용
        if (filterKey === "custom_fields" && customFields) {
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
                  projectId={projectId}
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
              {filterKey === "status" && (
                <AppliedStatusFilters
                  editable={isEditingAllowed ?? false}
                  handleRemove={(val) => handleRemoveFilter("status", val)}
                  values={Array.isArray(value) ? value : [value]}
                />
              )}
              {DATE_FILTERS.includes(filterKey) && (
                <AppliedDateFilters
                  editable={isEditingAllowed ?? false}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? value : [value]}
                />
              )}
              {MEMBERS_FILTERS.includes(filterKey) && (
                <AppliedMembersFilters
                  editable={isEditingAllowed ?? false}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? value : [value]}
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
          key="cycle_display_filters"
          className="flex flex-wrap items-center gap-2 rounded-md border border-custom-border-200 px-2 py-1 capitalize"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-custom-text-300">Cycles</span>
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
  );
});
