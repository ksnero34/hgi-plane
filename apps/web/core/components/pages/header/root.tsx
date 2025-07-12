import { useCallback } from "react";
import { observer } from "mobx-react";
import { ListFilter } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { TPageFilterProps, TPageNavigationTabs } from "@plane/types";
// components
import { Header, EHeaderVariant } from "@plane/ui";
import { calculateTotalFilters } from "@plane/utils";
import { FiltersDropdown } from "@/components/issues";
import {
  PageAppliedFiltersList,
  PageFiltersSelection,
  PageOrderByDropdown,
  PageSearchInput,
  PageTabNavigation,
} from "@/components/pages";
// helpers
import { calculateFilterValue , calculateFilterRemovalValue } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";

type Props = {
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
  folderId?: string | null;
};

export const PagesListHeaderRoot: React.FC<Props> = observer((props) => {
  const { pageType, projectId, storeType, workspaceSlug, folderId } = props;
  const { t } = useTranslation();
  // store hooks
  const { filters, updateFilters, clearAllFilters } = usePageStore(storeType);
  const {
    workspace: { workspaceMemberIds },
  } = useMember();

  const handleRemoveFilter = useCallback(
    (key: keyof TPageFilterProps, value: string | null) => {
      if (key === "favorites") {
        updateFilters("filters", { [key]: !!value });
        return;
      }

      const updatedValue = calculateFilterRemovalValue(key as any, value, filters.filters ?? {});
      updateFilters("filters", { [key]: updatedValue });
    },
    [filters.filters, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters?.filters ?? {}) !== 0;

  return (
    <>
      <Header variant={EHeaderVariant.SECONDARY}>
        <Header.LeftItem>
          <PageTabNavigation workspaceSlug={workspaceSlug} projectId={projectId} pageType={pageType} />
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <PageSearchInput
            searchQuery={filters.searchQuery}
            updateSearchQuery={(val) => updateFilters("searchQuery", val)}
          />
          <PageOrderByDropdown
            sortBy={filters.sortBy}
            sortKey={filters.sortKey}
            onChange={(val) => {
              if (val.key) updateFilters("sortKey", val.key);
              if (val.order) updateFilters("sortBy", val.order);
            }}
          />
          <FiltersDropdown
            icon={<ListFilter className="h-3 w-3" />}
            title={t("common.filters")}
            placement="bottom-end"
            isFiltersApplied={isFiltersApplied}
          >
            <PageFiltersSelection
              filters={filters}
              handleFiltersUpdate={updateFilters}
              memberIds={workspaceMemberIds ?? undefined}
            />
          </FiltersDropdown>
        </Header.RightItem>
      </Header>
      {calculateTotalFilters(filters?.filters ?? {}) !== 0 && (
        <Header variant={EHeaderVariant.TERNARY}>
          <PageAppliedFiltersList
            appliedFilters={filters.filters ?? {}}
            handleClearAllFilters={clearAllFilters}
            handleRemoveFilter={handleRemoveFilter}
            alwaysAllowEditing
          />
        </Header>
      )}
    </>
  );
});
