import React from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { CloseIcon } from "@plane/propel/icons";
import type { TModuleDisplayFilters, TModuleFilters, TCustomField } from "@plane/types";
// components
import { Header, EHeaderVariant, Tag } from "@plane/ui";
import { replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { AppliedDateFilters, AppliedMembersFilters, AppliedStatusFilters } from "@/components/modules";
import { AppliedCustomFieldFilters } from "@/components/issues/issue-layouts/filters/applied-filters";
// helpers
import {
  prepareCustomFieldFiltersForRender,
  removeCustomFieldFilterValue,
  removeCustomFieldFilterField,
} from "@plane/utils";
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

export function ModuleAppliedFiltersList(props: Props) {
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
      custom_fields: "커스텀 필드",
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
                        typeof appliedFilters.custom_fields === "string"
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
                          typeof appliedFilters.custom_fields === "string"
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
                    <CloseIcon height={12} width={12} strokeWidth={2} />
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
                    <CloseIcon height={10} width={10} strokeWidth={2} />
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
              <CloseIcon height={12} width={12} strokeWidth={2} />
            </Tag>
          </button>
        )}
      </div>
    </Header>
  );
}
