import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { TCycleFilters, TCycleGroups, TCustomField } from "@plane/types";
// components
import { FilterEndDate, FilterStartDate, FilterStatus } from "@/components/cycles";
import { FilterCustomFields } from "@/components/issues";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types

type Props = {
  filters: TCycleFilters;
  handleFiltersUpdate: (key: keyof TCycleFilters, value: string | string[]) => void;
  isArchived?: boolean;
};

export const CycleFiltersSelection: React.FC<Props> = observer((props) => {
  const { filters, handleFiltersUpdate, isArchived = false } = props;
  // states
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");
  const [customFields, setCustomFields] = useState<TCustomField[]>([]);
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false);
  // hooks
  const { isMobile } = usePlatformOS();
  const { workspaceSlug, projectId } = useParams();

  // 커스텀 필드 가져오기
  useEffect(() => {
    const fetchCustomFields = async () => {
      if (!workspaceSlug || !projectId || isLoadingCustomFields) return;
      
      console.log("CycleFiltersSelection - Fetching custom fields...");
      console.log("CycleFiltersSelection - workspaceSlug:", workspaceSlug);
      console.log("CycleFiltersSelection - projectId:", projectId);
      
      try {
        setIsLoadingCustomFields(true);
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
          {
            credentials: "include",
          }
        );
        console.log("CycleFiltersSelection - API response status:", response.status);
        console.log("CycleFiltersSelection - API response ok:", response.ok);
        
        if (response.ok) {
          const data = await response.json();
          console.log("CycleFiltersSelection - Custom fields data:", data);
          setCustomFields(data);
        } else {
          console.error("CycleFiltersSelection - API response not ok:", response.statusText);
        }
      } catch (error) {
        console.error("커스텀 필드 로드 중 오류:", error);
      } finally {
        setIsLoadingCustomFields(false);
      }
    };

    fetchCustomFields();
  }, [workspaceSlug, projectId]);

  // 커스텀 필드 필터 업데이트 핸들러
  const handleCustomFieldUpdate = (fieldId: string, value: string) => {
    // 현재 커스텀 필드 필터를 파싱
    let currentCustomFieldFilters: { [field_id: string]: string[] } = {};
    if (filters.custom_fields) {
      if (typeof filters.custom_fields === 'string' && filters.custom_fields.trim() !== '') {
        try {
          currentCustomFieldFilters = JSON.parse(filters.custom_fields);
        } catch (e) {
          console.error('Failed to parse custom_fields:', e);
          currentCustomFieldFilters = {};
        }
      } else if (typeof filters.custom_fields === 'object') {
        currentCustomFieldFilters = JSON.parse(JSON.stringify(filters.custom_fields));
      }
    }
    
    const currentFieldValues = currentCustomFieldFilters[fieldId] || [];
    
    let newFieldValues: string[];
    if (currentFieldValues.includes(value)) {
      newFieldValues = currentFieldValues.filter(v => v !== value);
    } else {
      newFieldValues = [...currentFieldValues, value];
    }
    
    const newCustomFieldFilters = {
      ...currentCustomFieldFilters,
      [fieldId]: newFieldValues.length > 0 ? newFieldValues : undefined
    };
    
    // 빈 배열인 필드들 제거
    Object.keys(newCustomFieldFilters).forEach(key => {
      const fieldValues = newCustomFieldFilters[key];
      if (!fieldValues || !Array.isArray(fieldValues) || fieldValues.length === 0) {
        delete newCustomFieldFilters[key];
      }
    });
    
    // JSON 문자열로 변환하여 전달 (빈 객체인 경우 빈 문자열)
    const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
      ? JSON.stringify(newCustomFieldFilters) 
      : "";
    
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
              <X className="text-custom-text-300" size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      <div className="h-full w-full divide-y divide-custom-border-200 overflow-y-auto px-2.5 vertical-scrollbar scrollbar-sm">
        {/* cycle status */}
        {!isArchived && (
          <div className="py-2">
            <FilterStatus
              appliedFilters={(filters.status as TCycleGroups[]) ?? null}
              handleUpdate={(val) => handleFiltersUpdate("status", val)}
              searchQuery={filtersSearchQuery}
            />
          </div>
        )}

        {/* start date */}
        <div className="py-2">
          <FilterStartDate
            appliedFilters={filters.start_date ?? null}
            handleUpdate={(val) => handleFiltersUpdate("start_date", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* end date */}
        <div className="py-2">
          <FilterEndDate
            appliedFilters={filters.end_date ?? null}
            handleUpdate={(val) => handleFiltersUpdate("end_date", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* custom fields */}
        <div className="py-2">
          {(() => {
            console.log("CycleFiltersSelection - About to render FilterCustomFields");
            console.log("CycleFiltersSelection - customFields state:", customFields);
            console.log("CycleFiltersSelection - customFields length:", customFields?.length);
            console.log("CycleFiltersSelection - workspaceSlug:", workspaceSlug);
            console.log("CycleFiltersSelection - projectId:", projectId);
            
            return (
              <FilterCustomFields
                appliedFilters={
                  filters.custom_fields && typeof filters.custom_fields === 'string' && filters.custom_fields.trim() !== ''
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
