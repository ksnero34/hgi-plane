import React, { useRef, useMemo } from "react";
import { observer } from "mobx-react";
// plane constants
import { SPREADSHEET_SELECT_GROUP, SPREADSHEET_PROPERTY_LIST } from "@plane/constants";
// types
import type { TIssue, IIssueDisplayFilterOptions, IIssueDisplayProperties, TCustomField } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
// components
import { MultipleSelectGroup } from "@/components/core/multiple-select";
// hooks
import { useProject } from "@/hooks/store/use-project";
// plane web components
import { IssueBulkOperationsRoot } from "@/plane-web/components/issues/bulk-operations";
// plane web hooks
import { useBulkOperationStatus } from "@/plane-web/hooks/use-bulk-operation-status";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { QuickAddIssueRoot, SpreadsheetAddIssueButton } from "../quick-add";
import { SpreadsheetTable } from "./spreadsheet-table";

type Props = {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  issueIds: string[] | undefined;
  quickActions: TRenderQuickActions;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  openIssuesListModal?: (() => void) | null;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  canEditProperties: (projectId: string | undefined) => boolean;
  canLoadMoreIssues: boolean;
  loadMoreIssues: () => void;
  enableQuickCreateIssue?: boolean;
  disableIssueCreation?: boolean;
  isWorkspaceLevel?: boolean;
  isEpic?: boolean;
  customFields?: TCustomField[];
};

export const SpreadsheetView = observer(function SpreadsheetView(props: Props) {
  const {
    displayProperties,
    displayFilters,
    handleDisplayFilterUpdate,
    issueIds,
    quickActions,
    updateIssue,
    quickAddCallback,
    canEditProperties,
    enableQuickCreateIssue,
    disableIssueCreation,
    canLoadMoreIssues,
    loadMoreIssues,
    isWorkspaceLevel = false,
    isEpic = false,
    customFields = [],
  } = props;
  // refs
  const containerRef = useRef<HTMLTableElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  // store hooks
  const { currentProjectDetails } = useProject();
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();

  const isEstimateEnabled: boolean = currentProjectDetails?.estimate !== null;

  // 커스텀 필드를 개별 컬럼으로 추가하는 로직
  const spreadsheetColumnsList = useMemo(() => {
    let baseColumns = isWorkspaceLevel
      ? SPREADSHEET_PROPERTY_LIST
      : SPREADSHEET_PROPERTY_LIST.filter((property) => {
          if (property === "cycle" && !currentProjectDetails?.cycle_view) return false;
          if (property === "modules" && !currentProjectDetails?.module_view) return false;
          return true;
        });

    // custom_fields 컬럼을 제거하고 개별 커스텀 필드 컬럼들로 대체
    baseColumns = baseColumns.filter((property) => property !== "custom_fields");

    // 활성화된 커스텀 필드들을 개별 컬럼으로 추가
    if (customFields && customFields.length > 0) {
      const customFieldColumns = customFields.map(
        (field) => `custom_field_${field.id}` as keyof IIssueDisplayProperties
      );
      baseColumns = [...baseColumns, ...customFieldColumns];
    }

    return baseColumns;
  }, [isWorkspaceLevel, currentProjectDetails, customFields]);

  if (!issueIds || issueIds.length === 0) return <></>;
  return (
    <div className="relative flex h-full w-full flex-col overflow-x-hidden whitespace-nowrap rounded-lg bg-custom-background-200 text-custom-text-200">
      <div ref={portalRef} className="spreadsheet-menu-portal" />
      <MultipleSelectGroup
        containerRef={containerRef}
        entities={{
          [SPREADSHEET_SELECT_GROUP]: issueIds,
        }}
        disabled={!isBulkOperationsEnabled || isEpic}
      >
        {(helpers) => (
          <>
            <div ref={containerRef} className="vertical-scrollbar horizontal-scrollbar scrollbar-lg h-full w-full">
              <SpreadsheetTable
                displayProperties={displayProperties}
                displayFilters={displayFilters}
                handleDisplayFilterUpdate={handleDisplayFilterUpdate}
                issueIds={issueIds}
                isEstimateEnabled={isEstimateEnabled}
                portalElement={portalRef}
                quickActions={quickActions}
                updateIssue={updateIssue}
                canEditProperties={canEditProperties}
                containerRef={containerRef}
                canLoadMoreIssues={canLoadMoreIssues}
                loadMoreIssues={loadMoreIssues}
                spreadsheetColumnsList={spreadsheetColumnsList}
                selectionHelpers={helpers}
                isEpic={isEpic}
                customFields={customFields}
              />
            </div>
            <div className="border-t border-custom-border-100">
              <div className="z-5 sticky bottom-0 left-0 mb-3">
                {enableQuickCreateIssue && !disableIssueCreation && (
                  <QuickAddIssueRoot
                    layout={EIssueLayoutTypes.SPREADSHEET}
                    QuickAddButton={SpreadsheetAddIssueButton}
                    quickAddCallback={quickAddCallback}
                    isEpic={isEpic}
                  />
                )}
              </div>
            </div>
            <IssueBulkOperationsRoot selectionHelpers={helpers} />
          </>
        )}
      </MultipleSelectGroup>
    </div>
  );
});
