import React, { useMemo, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import type { IIssueLabel } from "@plane/types";
// components
import { Loader } from "@plane/ui";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";

// ui
// types

function LabelIcons({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string) => void;
  labels: IIssueLabel[] | undefined;
  searchQuery: string;
};

export const FilterLabels = observer(function FilterLabels(props: Props) {
  const { appliedFilters, handleUpdate, labels, searchQuery } = props;

  const [itemsToRender, setItemsToRender] = useState(5);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const appliedFiltersCount = appliedFilters?.length ?? 0;

  const sortedOptions = useMemo(() => {
    const filteredOptions = (labels || []).filter((label) =>
      label.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return sortBy(filteredOptions, [
      (label) => !(appliedFilters ?? []).includes(label.id),
      (label) => label.name.toLowerCase(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleViewToggle = () => {
    if (!sortedOptions) return;

    if (itemsToRender === sortedOptions.length) setItemsToRender(5);
    else setItemsToRender(sortedOptions.length);
  };

  return (
    <>
      <FilterHeader
        title={`레이블 ${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {sortedOptions ? (
            sortedOptions.length > 0 ? (
              <>
                {sortedOptions.slice(0, itemsToRender).map((label) => (
                  <FilterOption
                    key={label?.id}
                    isChecked={appliedFilters?.includes(label?.id) ? true : false}
                    onClick={() => handleUpdate(label?.id)}
                    icon={<LabelIcons color={label.color} />}
                    title={label.name}
                  />
                ))}
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
            )
          ) : (
            <Loader className="space-y-2">
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
              <Loader.Item height="20px" />
            </Loader>
          )}
        </div>
      )}
    </>
  );
});
