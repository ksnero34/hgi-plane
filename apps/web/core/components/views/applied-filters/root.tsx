import React from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CloseIcon } from "@plane/propel/icons";
import type { EViewAccess, TViewFilterProps, TCustomField } from "@plane/types";
import { Tag } from "@plane/ui";
import {
  prepareCustomFieldFiltersForRender,
  removeCustomFieldFilterField,
  removeCustomFieldFilterValue,
  replaceUnderscoreIfSnakeCase,
} from "@plane/utils";
// components
import { AppliedDateFilters } from "@/components/common/applied-filters/date";
import { AppliedMembersFilters } from "@/components/common/applied-filters/members";
import { AppliedCustomFieldFilters } from "@/components/issues/issue-layouts/filters/applied-filters/custom-fields";
// local imports
import { AppliedAccessFilters } from "./access";

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

  if (!appliedFilters) return null;
  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed = alwaysAllowEditing ?? false;
  const effectiveProjectId = isProjectLevel ? projectId : viewProjectId;

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof TViewFilterProps) => {
    const filterLabels: Record<string, string> = {
      created_at: "생성일",
      owned_by: "소유자",
      favorites: "즐겨찾기",
      view_type: "접근 권한",
      custom_fields: "커스텀 필드",
    };

    return filterLabels[key] || replaceUnderscoreIfSnakeCase(key);
  };

  const serializedCustomFieldsValue =
    typeof appliedFilters.custom_fields === "string"
      ? appliedFilters.custom_fields
      : JSON.stringify(appliedFilters.custom_fields || {});

  const renderedFilters: JSX.Element[] = [];

  Object.entries(appliedFilters).forEach(([key, value]) => {
    const filterKey = key as keyof TViewFilterProps;

    if (!value) return;
    if (Array.isArray(value) && value.length === 0) return;

    if (filterKey === "custom_fields" && customFields && isProjectLevel && effectiveProjectId) {
      const customFieldsForRender = prepareCustomFieldFiltersForRender(serializedCustomFieldsValue, customFields);

      customFieldsForRender.forEach(({ fieldId, field, fieldValues }) => {
        renderedFilters.push(
          <Tag key={`${filterKey}-${fieldId}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-custom-text-300">{field.name}</span>
              <AppliedCustomFieldFilters
                appliedFilters={{ [fieldId]: fieldValues }}
                customFields={customFields}
                editable={isEditingAllowed}
                handleRemove={(fieldId, val) => {
                  const newValue = removeCustomFieldFilterValue(serializedCustomFieldsValue, fieldId, val);
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
                    const newValue = removeCustomFieldFilterField(serializedCustomFieldsValue, fieldId);
                    handleRemoveFilter("custom_fields", newValue);
                  }}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          </Tag>
        );
      });
      return;
    }

    renderedFilters.push(
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
  });

  return (
    <div className="flex flex-wrap items-stretch gap-2 bg-custom-background-100">
      {renderedFilters}
      {isEditingAllowed && (
        <button type="button" onClick={handleClearAllFilters}>
          <Tag>
            {t("common.clear_all")}
            <CloseIcon height={12} width={12} strokeWidth={2} />
          </Tag>
        </button>
      )}
    </div>
  );
});
