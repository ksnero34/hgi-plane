import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
// plane imports
import type { TModuleStatus } from "@plane/propel/icons";
import { CloseIcon } from "@plane/propel/icons";
import type { TModuleDisplayFilters, TModuleFilters } from "@plane/types";
import { FilterCustomFields } from "@/components/issues/issue-layouts/filters/header/filters";
// components
import { FilterOption } from "@/components/issues/issue-layouts/filters";
import { FilterLead, FilterMembers, FilterStartDate, FilterStatus, FilterTargetDate } from "@/components/modules";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useCustomField } from "@/hooks/store/use-custom-field";
// types

type Props = {
  displayFilters: TModuleDisplayFilters;
  filters: TModuleFilters;
  handleDisplayFiltersUpdate: (updatedDisplayProperties: Partial<TModuleDisplayFilters>) => void;
  handleFiltersUpdate: (key: keyof TModuleFilters, value: string | string[]) => void;
  memberIds?: string[] | undefined;
  isArchived?: boolean;
};

export const ModuleFiltersSelection = observer(function ModuleFiltersSelection(props: Props) {
  const {
    displayFilters,
    filters,
    handleDisplayFiltersUpdate,
    handleFiltersUpdate,
    memberIds,
    isArchived = false,
  } = props;
  // states
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");
  // store
  const { isMobile } = usePlatformOS();
  const { workspaceSlug, projectId } = useParams();
  const { customFields } = useCustomField();

  // 디버깅: useParams 값 확인
  // console.log("ModuleFiltersSelection - useParams() 전체 값:", useParams());
  // console.log("ModuleFiltersSelection - workspaceSlug:", workspaceSlug);
  // console.log("ModuleFiltersSelection - projectId:", projectId);

  // 커스텀 필드 필터 업데이트 핸들러
  const handleCustomFieldUpdate = (fieldId: string, value: string) => {
    // 현재 커스텀 필드 필터를 파싱
    let currentCustomFieldFilters: { [field_id: string]: string[] } = {};
    if (filters.custom_fields) {
      if (typeof filters.custom_fields === "string" && filters.custom_fields.trim() !== "") {
        try {
          currentCustomFieldFilters = JSON.parse(filters.custom_fields);
        } catch (e) {
          console.error("Failed to parse custom_fields:", e);
          currentCustomFieldFilters = {};
        }
      } else if (typeof filters.custom_fields === "object") {
        currentCustomFieldFilters = JSON.parse(JSON.stringify(filters.custom_fields));
      }
    }

    const currentFieldValues = currentCustomFieldFilters[fieldId] || [];

    let newFieldValues: string[];
    if (currentFieldValues.includes(value)) {
      newFieldValues = currentFieldValues.filter((v) => v !== value);
    } else {
      newFieldValues = [...currentFieldValues, value];
    }

    const newCustomFieldFilters = {
      ...currentCustomFieldFilters,
      [fieldId]: newFieldValues.length > 0 ? newFieldValues : undefined,
    };

    // 빈 배열인 필드들 제거
    Object.keys(newCustomFieldFilters).forEach((key) => {
      const fieldValues = newCustomFieldFilters[key];
      if (!fieldValues || fieldValues.length === 0) {
        delete newCustomFieldFilters[key];
      }
    });

    // JSON 문자열로 변환하여 전달 (빈 객체인 경우 빈 문자열)
    const customFieldsValue =
      Object.keys(newCustomFieldFilters).length > 0 ? JSON.stringify(newCustomFieldFilters) : "";

    handleFiltersUpdate("custom_fields", customFieldsValue);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="bg-custom-background-100 p-2.5 pb-0">
        <div className="flex items-center gap-1.5 rounded border-[0.5px] border-custom-border-200 bg-custom-background-90 px-1.5 py-1 text-xs">
          <Search className="text-custom-text-400" size={12} strokeWidth={2} />
          <input
            type="text"
            className="w-full bg-custom-background-90 outline-none placeholder:text-custom-text-400"
            placeholder="Search"
            value={filtersSearchQuery}
            onChange={(e) => setFiltersSearchQuery(e.target.value)}
            autoFocus={!isMobile}
          />
          {filtersSearchQuery !== "" && (
            <button type="button" className="grid place-items-center" onClick={() => setFiltersSearchQuery("")}>
              <CloseIcon className="text-custom-text-300" height={12} width={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      <div className="h-full w-full divide-y divide-custom-border-200 overflow-y-auto px-2.5 vertical-scrollbar scrollbar-sm">
        {!isArchived && (
          <div className="py-2">
            <FilterOption
              isChecked={!!displayFilters.favorites}
              onClick={() =>
                handleDisplayFiltersUpdate({
                  favorites: !displayFilters.favorites,
                })
              }
              title="Favorites"
            />
          </div>
        )}

        {/* status */}
        {!isArchived && (
          <div className="py-2">
            <FilterStatus
              appliedFilters={(filters.status as TModuleStatus[]) ?? null}
              handleUpdate={(val) => handleFiltersUpdate("status", val)}
              searchQuery={filtersSearchQuery}
            />
          </div>
        )}

        {/* lead */}
        <div className="py-2">
          <FilterLead
            appliedFilters={filters.lead ?? null}
            handleUpdate={(val) => handleFiltersUpdate("lead", val)}
            searchQuery={filtersSearchQuery}
            memberIds={memberIds}
          />
        </div>

        {/* members */}
        <div className="py-2">
          <FilterMembers
            appliedFilters={filters.members ?? null}
            handleUpdate={(val) => handleFiltersUpdate("members", val)}
            searchQuery={filtersSearchQuery}
            memberIds={memberIds}
          />
        </div>

        {/* start date */}
        <div className="py-2">
          <FilterStartDate
            appliedFilters={filters.start_date ?? null}
            handleUpdate={(val) => handleFiltersUpdate("start_date", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* target date */}
        <div className="py-2">
          <FilterTargetDate
            appliedFilters={filters.target_date ?? null}
            handleUpdate={(val) => handleFiltersUpdate("target_date", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* custom fields */}
        <div className="py-2">
          {(() => {
            // console.log("ModuleFiltersSelection - About to render FilterCustomFields");
            // console.log("ModuleFiltersSelection - customFields state:", customFields);
            // console.log("ModuleFiltersSelection - customFields length:", customFields?.length);
            // console.log("ModuleFiltersSelection - workspaceSlug:", workspaceSlug);
            // console.log("ModuleFiltersSelection - projectId:", projectId);

            return (
              <FilterCustomFields
                appliedFilters={
                  filters.custom_fields &&
                  typeof filters.custom_fields === "string" &&
                  filters.custom_fields.trim() !== ""
                    ? JSON.parse(filters.custom_fields)
                    : {}
                }
                handleUpdate={handleCustomFieldUpdate}
                searchQuery={filtersSearchQuery}
                customFields={customFields || []}
                workspaceSlug={workspaceSlug as string}
                projectId={projectId as string}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
});
