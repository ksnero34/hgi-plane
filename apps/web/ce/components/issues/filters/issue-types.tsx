import type React from "react";
import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { sortBy } from "lodash-es";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
// components
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters/header/helpers";
import { IssueTypeIcon } from "../issue-type-icon";
import { Loader } from "@plane/ui";

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
};

export const FilterIssueTypes = observer((props: Props) => {
  const { appliedFilters, handleUpdate, searchQuery } = props;

  // hooks
  const { projectId } = useParams();
  const { issueTypes, isLoading } = useIssueType(projectId as string);

  // states
  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const sortedOptions = useMemo(() => {
    const filteredOptions = (issueTypes || []).filter((issueType: any) => {
      const actualIssueType = issueType.issue_type || issueType;
      return actualIssueType.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return sortBy(filteredOptions, [
      (issueType: any) => {
        const actualIssueType = issueType.issue_type || issueType;
        return !(appliedFilters ?? []).includes(actualIssueType.id);
      },
      (issueType: any) => {
        const actualIssueType = issueType.issue_type || issueType;
        return actualIssueType.name.toLowerCase();
      },
    ]);
  }, [issueTypes, searchQuery, appliedFilters]);

  const handleViewToggle = () => {
    if (!sortedOptions) return;

    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={`이슈 타입 ${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {isLoading ? (
            <Loader className="space-y-2">
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
            </Loader>
          ) : sortedOptions && sortedOptions.length > 0 ? (
            <>
              {sortedOptions.slice(0, itemsToRender).map((issueType: any) => {
                const actualIssueType = issueType.issue_type || issueType;
                return (
                  <FilterOption
                    key={actualIssueType.id}
                    isChecked={appliedFilters?.includes(actualIssueType.id) ? true : false}
                    onClick={() => handleUpdate(actualIssueType.id)}
                    icon={
                      <IssueTypeIcon
                        issueType={actualIssueType}
                        size={14}
                        showTooltip={false}
                        className="flex-shrink-0"
                      />
                    }
                    title={actualIssueType.name}
                  />
                );
              })}
              {sortedOptions.length > 5 && (
                <button
                  type="button"
                  className="ml-8 text-xs font-medium text-custom-primary-100"
                  onClick={handleViewToggle}
                >
                  {itemsToRender === sortedOptions.length ? "줄여서 보기" : "모두 보기"}
                </button>
              )}
            </>
          ) : (
            <p className="text-xs italic text-custom-text-400">일치하는 항목 없음</p>
          )}
        </div>
      )}
    </>
  );
});
