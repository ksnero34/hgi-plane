import { observer } from "mobx-react";
import { Fragment } from "react";
import { X } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TCycleDisplayFilters, TCycleFilters, TCustomField } from "@plane/types";
import { Tag } from "@plane/ui";
import {
  prepareCustomFieldFiltersForRender,
  removeCustomFieldFilterField,
  removeCustomFieldFilterValue,
  replaceUnderscoreIfSnakeCase,
  parseCustomFieldFilter,
} from "@plane/utils";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// components
import { AppliedMembersFilters } from "@/components/common/applied-filters/members";
import { AppliedCustomFieldFilters } from "@/components/issues/issue-layouts/filters/applied-filters/custom-fields";
// local imports
import { AppliedDateFilters } from "./date";
import { AppliedStatusFilters } from "./status";

type Props = {
  appliedFilters: TCycleFilters;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TCycleFilters, value: string | null) => void;
  alwaysAllowEditing?: boolean;
  isFavoriteFilterApplied?: boolean;
  handleDisplayFiltersUpdate?: (filters: Partial<TCycleDisplayFilters>) => void;
  customFields?: TCustomField[];
  projectId?: string;
  isArchived?: boolean;
};

const DATE_FILTERS = ["start_date", "end_date"];
const MEMBERS_FILTERS = ["members", "lead"];

const getCustomFieldsValue = (value: TCycleFilters["custom_fields"]) => {
  if (!value) return null;
  if (typeof value === "string") return value === "" ? null : value;

  try {
    const stringified = JSON.stringify(value);
    return stringified === "{}" ? null : stringified;
  } catch (error) {
    console.error("Failed to stringify custom field filters", error);
    return null;
  }
};

const getFilterKeyLabel = (key: keyof TCycleFilters) => {
  const labelMap: Record<string, string> = {
    lead: "리더",
    members: "멤버",
    start_date: "시작일",
    end_date: "종료일",
    status: "상태",
    custom_fields: "커스텀 필드",
  };

  return labelMap[key] ?? replaceUnderscoreIfSnakeCase(key);
};

export const CycleAppliedFiltersList: React.FC<Props> = observer((props) => {
  const {
    appliedFilters,
    handleClearAllFilters,
    handleRemoveFilter,
    alwaysAllowEditing,
    isFavoriteFilterApplied,
    handleDisplayFiltersUpdate,
    customFields,
    projectId,
    isArchived = false,
  } = props;
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  if (!appliedFilters && !isFavoriteFilterApplied) return null;

  if (Object.keys(appliedFilters).length === 0 && !isFavoriteFilterApplied) return null;

  const isEditingAllowed =
    alwaysAllowEditing ||
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  return (
    <div className="flex flex-wrap items-stretch gap-2 bg-custom-background-100">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof TCycleFilters;

        if (!value) return null;
        if (Array.isArray(value) && value.length === 0) return null;

        if (filterKey === "custom_fields") {
          if (Array.isArray(value)) return null;

          const customFieldsValue = getCustomFieldsValue(value);
          if (!customFieldsValue) return null;

          const availableCustomFields = customFields ?? [];

          if (availableCustomFields.length > 0) {
            let customFieldsForRender: ReturnType<typeof prepareCustomFieldFiltersForRender> = [];
            try {
              customFieldsForRender = prepareCustomFieldFiltersForRender(customFieldsValue, availableCustomFields);
            } catch (error) {
              console.error("Failed to prepare custom field filters", error);
            }

            if (customFieldsForRender.length === 0) return null;

            return customFieldsForRender.map(({ fieldId, field, fieldValues }) => (
              <Tag key={`${filterKey}-${fieldId}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-custom-text-300">{field.name}</span>
                  <AppliedCustomFieldFilters
                    appliedFilters={{ [fieldId]: fieldValues }}
                    customFields={availableCustomFields}
                    editable={Boolean(isEditingAllowed)}
                    handleRemove={(fieldIdToRemove, val) => {
                      const newValue = removeCustomFieldFilterValue(customFieldsValue, fieldIdToRemove, val);
                      handleRemoveFilter("custom_fields", newValue ?? null);
                    }}
                    projectId={projectId}
                  />
                  {isEditingAllowed && (
                    <button
                      type="button"
                      className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                      onClick={() => {
                        const updatedValue = removeCustomFieldFilterField(customFieldsValue, fieldId);
                        handleRemoveFilter("custom_fields", updatedValue ?? null);
                      }}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </Tag>
            ));
          }

          const parsedCustomFields = (() => {
            try {
              return parseCustomFieldFilter(customFieldsValue);
            } catch (error) {
              console.error("Failed to parse custom field filters", error);
              return {} as Record<string, string[]>;
            }
          })();

          return Object.entries(parsedCustomFields).map(([fieldId, fieldValues]) => {
            if (!Array.isArray(fieldValues) || fieldValues.length === 0) return null;

            return (
              <Tag key={`${filterKey}-${fieldId}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-custom-text-300">{fieldId}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {fieldValues.map((fieldValue) => (
                      <div
                        key={`${fieldId}-${fieldValue}`}
                        className="flex items-center gap-1 rounded bg-custom-background-80 py-1 px-1.5 text-xs"
                      >
                        <span className="normal-case">{fieldValue}</span>
                        {isEditingAllowed && (
                          <button
                            type="button"
                            className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                            onClick={() => {
                              const newValue = removeCustomFieldFilterValue(customFieldsValue, fieldId, fieldValue);
                              handleRemoveFilter("custom_fields", newValue ?? null);
                            }}
                          >
                            <X size={10} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isEditingAllowed && (
                    <button
                      type="button"
                      className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                      onClick={() => {
                        const updatedValue = removeCustomFieldFilterField(customFieldsValue, fieldId);
                        handleRemoveFilter("custom_fields", updatedValue ?? null);
                      }}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </Tag>
            );
          });
        }

        return (
          <Tag key={filterKey}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-custom-text-300">{getFilterKeyLabel(filterKey)}</span>
              {filterKey === "status" && (
                <AppliedStatusFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter("status", val)}
                  values={Array.isArray(value) ? value : [value]}
                />
              )}
              {DATE_FILTERS.includes(filterKey) && (
                <AppliedDateFilters
                  editable={isEditingAllowed}
                  handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                  values={Array.isArray(value) ? value : [value]}
                />
              )}
              {MEMBERS_FILTERS.includes(filterKey) && (
                <AppliedMembersFilters
                  editable={isEditingAllowed}
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
        <Fragment key="cycle_display_filters">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-custom-border-200 px-2 py-1 capitalize">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-custom-text-300">Cycles</span>
              <div className="flex items-center gap-1 rounded bg-custom-background-80 p-1 text-xs">
                Favorite
                {isEditingAllowed && handleDisplayFiltersUpdate && (
                  <button
                    type="button"
                    className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                    onClick={() =>
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
        </Fragment>
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
