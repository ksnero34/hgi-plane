import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import { CloseIcon } from "@plane/propel/icons";
import type { TViewFilterProps, TViewFilters, TCustomField } from "@plane/types";
import { EViewAccess } from "@plane/types";
// components
import { FilterCreatedDate } from "@/components/common/filters/created-at";
import { FilterCreatedBy } from "@/components/common/filters/created-by";
import { FilterOption } from "@/components/issues/issue-layouts/filters";
import { FilterCustomFields } from "@/components/issues/issue-layouts/filters/header/filters/custom-fields";
// constants
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useCustomField } from "@/hooks/store/use-custom-field";
// plane web components
import { FilterByAccess } from "@/plane-web/components/views/filters/access-filter";

type Props = {
  filters: TViewFilters;
  handleFiltersUpdate: <T extends keyof TViewFilters>(filterKey: T, filterValue: TViewFilters[T]) => void;
  memberIds?: string[] | undefined;
  isProjectLevel?: boolean;
  viewProjectId?: string;
};

export const ViewFiltersSelection: React.FC<Props> = observer((props) => {
  const { filters, handleFiltersUpdate, memberIds, isProjectLevel = false, viewProjectId } = props;

  // 컴포넌트 렌더링 확인을 위한 로그
  // console.log("ViewFiltersSelection - Component rendered");
  // console.log("ViewFiltersSelection - props:", { isProjectLevel, viewProjectId, memberIds: memberIds?.length });
  // states
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");
  // store
  const { isMobile } = usePlatformOS();
  const { workspaceSlug, projectId } = useParams();

  // 실제 사용할 projectId 결정 (뷰가 프로젝트 레벨인 경우 viewProjectId 사용, 아니면 URL의 projectId 사용)
  const effectiveProjectId = isProjectLevel ? viewProjectId : (projectId as string);
  const { customFields, isLoading: isLoadingCustomFields } = useCustomField(
    isProjectLevel && effectiveProjectId ? effectiveProjectId : undefined
  );

  // console.log("ViewFiltersSelection - URL params:", { workspaceSlug, projectId });
  // console.log("ViewFiltersSelection - effectiveProjectId:", effectiveProjectId);

  // handles filter update
  const handleFilters = (key: keyof TViewFilterProps, value: boolean | string | EViewAccess | string[]) => {
    const currValues = (filters.filters?.[key] ?? []) as (string | EViewAccess)[];

    if (typeof currValues === "boolean" && typeof value === "boolean") return;

    if (Array.isArray(currValues)) {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          if (!currValues.includes(val)) currValues.push(val);
          else currValues.splice(currValues.indexOf(val), 1);
        });
      } else if (typeof value !== "boolean") {
        if (currValues?.includes(value)) currValues.splice(currValues.indexOf(value), 1);
        else currValues.push(value);
      }
    }

    handleFiltersUpdate("filters", {
      ...filters.filters,
      [key]: currValues,
    });
  };

  // 커스텀 필드 필터 업데이트 핸들러
  const handleCustomFieldUpdate = (fieldId: string, value: string) => {
    // console.log("ViewFiltersSelection - handleCustomFieldUpdate called:", fieldId, value);
    // console.log("ViewFiltersSelection - current filters.filters?.custom_fields:", filters.filters?.custom_fields);

    // 현재 커스텀 필드 필터를 파싱
    let currentCustomFieldFilters: { [field_id: string]: string[] } = {};
    if (filters.filters?.custom_fields) {
      if (typeof filters.filters.custom_fields === "string" && filters.filters.custom_fields.trim() !== "") {
        try {
          currentCustomFieldFilters = JSON.parse(filters.filters.custom_fields);
        } catch (e) {
          // console.error('Failed to parse custom_fields:', e);
          currentCustomFieldFilters = {};
        }
      } else if (typeof filters.filters.custom_fields === "object") {
        currentCustomFieldFilters = JSON.parse(JSON.stringify(filters.filters.custom_fields));
      }
    }

    // console.log("ViewFiltersSelection - parsed currentCustomFieldFilters:", currentCustomFieldFilters);

    const currentFieldValues = currentCustomFieldFilters[fieldId] || [];

    let newFieldValues: string[];
    if (currentFieldValues.includes(value)) {
      newFieldValues = currentFieldValues.filter((v) => v !== value);
    } else {
      newFieldValues = [...currentFieldValues, value];
    }

    // console.log("ViewFiltersSelection - newFieldValues:", newFieldValues);

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

    // console.log("ViewFiltersSelection - final customFieldsValue:", customFieldsValue);

    handleFiltersUpdate("filters", {
      ...filters.filters,
      custom_fields: customFieldsValue || null,
    });
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
        <div className="py-2">
          <FilterOption
            isChecked={!!filters.filters?.favorites}
            onClick={() =>
              handleFiltersUpdate("filters", {
                ...filters.filters,
                favorites: !filters.filters?.favorites,
              })
            }
            title="Favorites"
          />
        </div>

        {/* access / view type */}
        <FilterByAccess
          appliedFilters={filters.filters?.view_type}
          handleUpdate={(val: string | string[]) => handleFilters("view_type", val)}
          searchQuery={filtersSearchQuery}
          accessFilters={[
            { key: EViewAccess.PRIVATE, value: "Private" },
            { key: EViewAccess.PUBLIC, value: "Public" },
          ]}
        />

        {/* created date */}
        <div className="py-2">
          <FilterCreatedDate
            appliedFilters={filters.filters?.created_at ?? null}
            handleUpdate={(val: string | string[]) => handleFilters("created_at", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* created by */}
        <div className="py-2">
          <FilterCreatedBy
            appliedFilters={filters.filters?.owned_by ?? null}
            handleUpdate={(val) => handleFilters("owned_by", val)}
            searchQuery={filtersSearchQuery}
            memberIds={memberIds}
          />
        </div>

        {/* custom fields - 프로젝트 레벨인 경우에만 표시 */}
        {(() => {
          // console.log("ViewFiltersSelection - Checking custom fields render condition:");
          // console.log("ViewFiltersSelection - isProjectLevel:", isProjectLevel);
          // console.log("ViewFiltersSelection - effectiveProjectId:", effectiveProjectId);
          // console.log("ViewFiltersSelection - customFields.length:", customFields.length);
          // console.log("ViewFiltersSelection - isLoadingCustomFields:", isLoadingCustomFields);

          const shouldRender = isProjectLevel && effectiveProjectId && !isLoadingCustomFields;
          // console.log("ViewFiltersSelection - shouldRender:", shouldRender);

          if (shouldRender) {
            return (
              <div>
                <FilterCustomFields
                  appliedFilters={(() => {
                    const customFieldsData = filters.filters?.custom_fields;
                    // console.log("ViewFiltersSelection - raw custom_fields:", customFieldsData);

                    if (customFieldsData && typeof customFieldsData === "string" && customFieldsData.trim() !== "") {
                      try {
                        const parsed = JSON.parse(customFieldsData);
                        // console.log("ViewFiltersSelection - parsed custom_fields:", parsed);
                        return parsed;
                      } catch (e) {
                        // console.error("ViewFiltersSelection - failed to parse custom_fields:", e);
                        return {};
                      }
                    }
                    return {};
                  })()}
                  handleUpdate={handleCustomFieldUpdate}
                  searchQuery={filtersSearchQuery}
                  customFields={customFields || []}
                  workspaceSlug={workspaceSlug as string}
                  projectId={effectiveProjectId}
                />
              </div>
            );
          } else if (isProjectLevel && effectiveProjectId && isLoadingCustomFields) {
            // 로딩 중일 때 표시
            return <div style={{ padding: "8px", fontSize: "12px", color: "gray" }}>커스텀 필드 로딩 중...</div>;
          }
          return null;
        })()}
      </div>
    </div>
  );
});
