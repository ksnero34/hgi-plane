import type { RefObject } from "react";
import { useState, useMemo } from "react";
import { observer } from "mobx-react";
// ui
import type { IBlockUpdateData, TGroupedIssues, TIssueGroupByOptions, TIssueOrderByOptions } from "@plane/types";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import { Loader } from "@plane/ui";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { GanttLayoutListItemLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
//hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import { useIssues } from "@/hooks/store/use-issues";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { useTimeLineChart } from "../../../../hooks/use-timeline-chart";
import { GanttDnDHOC } from "../gantt-dnd-HOC";
import { handleOrderChange } from "../utils";
import { IssuesSidebarBlock } from "./block";
import { getGroupByColumns, isSubGrouped } from "@/components/issues/issue-layouts/utils";

type Props = {
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void;
  canLoadMoreBlocks?: boolean;
  loadMoreBlocks?: () => void;
  ganttContainerRef: RefObject<HTMLDivElement>;
  blockIds: string[];
  enableReorder: boolean;
  enableSelection: boolean;
  showAllBlocks?: boolean;
  selectionHelpers?: TSelectionHelper;
  isEpic?: boolean;
  groupBy?: TIssueGroupByOptions | null;
  groupedIssueIds?: TGroupedIssues;
  groupByFields?: any[];
  issueTypes?: any[];
  orderBy?: TIssueOrderByOptions;
};

export const IssueGanttSidebar = observer(function IssueGanttSidebar(props: Props) {
  const {
    blockUpdateHandler,
    blockIds,
    enableReorder,
    enableSelection,
    loadMoreBlocks,
    canLoadMoreBlocks,
    ganttContainerRef,
    showAllBlocks = false,
    selectionHelpers,
    isEpic = false,
    groupBy = null,
    groupedIssueIds,
    groupByFields,
    issueTypes = [],
    orderBy,
  } = props;

  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);

  const {
    issues: { getIssueLoader },
  } = useIssuesStore();

  const { issueMap } = useIssues();

  const [intersectionElement, setIntersectionElement] = useState<HTMLDivElement | null>(null);

  const isPaginating = !!getIssueLoader();

  useIntersectionObserver(
    ganttContainerRef,
    isPaginating ? null : intersectionElement,
    loadMoreBlocks,
    "100% 0% 100% 0%"
  );

  const handleOnDrop = (
    draggingBlockId: string | undefined,
    droppedBlockId: string | undefined,
    dropAtEndOfList: boolean
  ) => {
    handleOrderChange(draggingBlockId, droppedBlockId, dropAtEndOfList, blockIds, getBlockById, blockUpdateHandler);
  };

  // Get group columns if grouping is enabled
  const groups = useMemo(() => {
    if (!groupBy || !groupedIssueIds) return null;

    return getGroupByColumns({
      groupBy: groupBy as any,
      includeNone: true,
      isWorkspaceLevel: false,
      isEpic: isEpic,
      groupedIssueIds: groupedIssueIds,
      issuesMap: issueMap,
      projectId: undefined,
      groupByFields: groupByFields,
      issueTypes: issueTypes,
      orderBy,
    });
  }, [groupBy, groupedIssueIds, groupByFields, issueMap, isEpic, issueTypes, orderBy]);

  // Group blocks by group ID
  const groupedBlocks = useMemo(() => {
    if (!groups || !groupedIssueIds || !groupBy) return null;

    const result: Record<string, string[]> = {};
    groups.forEach((group) => {
      const groupIssueIds = groupedIssueIds[group.id] || [];
      result[group.id] = Array.isArray(groupIssueIds) ? groupIssueIds : [];
    });

    return result;
  }, [groups, groupedIssueIds, groupBy]);

  return (
    <div>
      {blockIds ? (
        <>
          {!groupBy || !groups || !groupedBlocks ? (
            // Non-grouped view
            <>
              {blockIds.map((blockId, index) => {
                const block = getBlockById(blockId);
                const isBlockVisibleOnSidebar = block?.start_date && block?.target_date;

                // hide the block if it doesn't have start and target dates and showAllBlocks is false
                if (!block || (!showAllBlocks && !isBlockVisibleOnSidebar)) return;

                return (
                  <RenderIfVisible
                    key={block.id}
                    root={ganttContainerRef}
                    horizontalOffset={100}
                    verticalOffset={200}
                    shouldRecordHeights={false}
                    placeholderChildren={<GanttLayoutListItemLoader />}
                  >
                    <GanttDnDHOC
                      id={block.id}
                      isLastChild={index === blockIds.length - 1}
                      isDragEnabled={enableReorder}
                      onDrop={handleOnDrop}
                    >
                      {(isDragging: boolean) => (
                        <IssuesSidebarBlock
                          block={block}
                          enableSelection={enableSelection}
                          isDragging={isDragging}
                          selectionHelpers={selectionHelpers}
                          isEpic={isEpic}
                        />
                      )}
                    </GanttDnDHOC>
                  </RenderIfVisible>
                );
              })}
            </>
          ) : (
            // Grouped view
            <>
              {groups.map((group) => {
                const groupIssueIds = groupedBlocks[group.id] || [];

                if (groupIssueIds.length === 0) return null;

                return (
                  <div key={group.id} className="mb-2">
                    {/* Group Header */}
                    <div className="sticky top-0 z-[1] bg-custom-background-90 border-b border-custom-border-200 px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        {group.icon && <span className="flex-shrink-0">{group.icon}</span>}
                        <h3 className="text-xs font-medium text-custom-text-300 truncate">{group.name}</h3>
                        <span className="text-xs text-custom-text-400">({groupIssueIds.length})</span>
                      </div>
                    </div>

                    {/* Group Items */}
                    {groupIssueIds.map((blockId, index) => {
                      const block = getBlockById(blockId);
                      const isBlockVisibleOnSidebar = block?.start_date && block?.target_date;

                      // hide the block if it doesn't have start and target dates and showAllBlocks is false
                      if (!block || (!showAllBlocks && !isBlockVisibleOnSidebar)) return null;

                      return (
                        <RenderIfVisible
                          key={block.id}
                          root={ganttContainerRef}
                          horizontalOffset={100}
                          verticalOffset={200}
                          shouldRecordHeights={false}
                          placeholderChildren={<GanttLayoutListItemLoader />}
                        >
                          <GanttDnDHOC
                            id={block.id}
                            isLastChild={index === groupIssueIds.length - 1}
                            isDragEnabled={enableReorder}
                            onDrop={handleOnDrop}
                          >
                            {(isDragging: boolean) => (
                              <IssuesSidebarBlock
                                block={block}
                                enableSelection={enableSelection}
                                isDragging={isDragging}
                                selectionHelpers={selectionHelpers}
                                isEpic={isEpic}
                              />
                            )}
                          </GanttDnDHOC>
                        </RenderIfVisible>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
          {canLoadMoreBlocks && (
            <div ref={setIntersectionElement} className="p-2">
              <div className="flex h-10 md:h-8 w-full items-center justify-between gap-1.5 rounded md:px-1 px-4 py-1.5 bg-custom-background-80 animate-pulse" />
            </div>
          )}
        </>
      ) : (
        <Loader className="space-y-3 pr-2">
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
        </Loader>
      )}
    </div>
  );
});
