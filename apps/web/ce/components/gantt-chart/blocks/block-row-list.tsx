import type { FC } from "react";
import { useMemo } from "react";
// components
import type {
  IBlockUpdateData,
  IGanttBlock,
  TGroupedIssues,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { GanttChartGroupHeader } from "@/components/gantt-chart/blocks/group-header";
import { BlockRow } from "@/components/gantt-chart/blocks/block-row";
import { BLOCK_HEIGHT } from "@/components/gantt-chart/constants";
import { getGroupByColumns } from "@/components/issues/issue-layouts/utils";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { useIssues } from "@/hooks/store/use-issues";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
// types

export type GanttChartBlocksProps = {
  blockIds: string[];
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void;
  handleScrollToBlock: (block: IGanttBlock) => void;
  enableAddBlock: boolean | ((blockId: string) => boolean);
  showAllBlocks: boolean;
  selectionHelpers: TSelectionHelper;
  ganttContainerRef: React.RefObject<HTMLDivElement>;
  groupBy?: TIssueGroupByOptions | null;
  groupedIssueIds?: TGroupedIssues;
  groupByFields?: any[];
  issueTypes?: any[];
  isEpic?: boolean;
  orderBy?: TIssueOrderByOptions;
};

export function GanttChartRowList(props: GanttChartBlocksProps) {
  const {
    blockIds,
    blockUpdateHandler,
    handleScrollToBlock,
    enableAddBlock,
    showAllBlocks,
    selectionHelpers,
    ganttContainerRef,
    groupBy,
    groupedIssueIds,
    groupByFields,
    issueTypes,
    isEpic = false,
    orderBy,
  } = props;
  const { issueMap } = useIssues();
  const { getBlockById } = useTimeLineChartStore();

  const groups = useMemo(() => {
    if (!groupBy || !groupedIssueIds) return null;

    return getGroupByColumns({
      groupBy: groupBy as any,
      includeNone: true,
      isWorkspaceLevel: false,
      isEpic,
      groupedIssueIds,
      issuesMap: issueMap,
      projectId: undefined,
      groupByFields,
      issueTypes,
      orderBy,
    });
  }, [groupBy, groupedIssueIds, groupByFields, issueMap, isEpic, issueTypes, orderBy]);

  const groupedBlocks = useMemo(() => {
    if (!groups || !groupedIssueIds || !groupBy) return null;

    const result: Record<string, string[]> = {};
    groups.forEach((group) => {
      const groupIssueIds = groupedIssueIds[group.id] || [];
      result[group.id] = Array.isArray(groupIssueIds) ? groupIssueIds : [];
    });

    return result;
  }, [groups, groupedIssueIds, groupBy]);

  const renderBlockRow = (blockId: string) => {
    const block = getBlockById(blockId);
    const shouldHideBlock = !block || !block.data || (!showAllBlocks && !(block.start_date && block.target_date));

    if (shouldHideBlock) return null;

    return (
      <RenderIfVisible
        key={blockId}
        root={ganttContainerRef}
        horizontalOffset={100}
        verticalOffset={200}
        classNames="relative min-w-full w-max"
        placeholderChildren={<div className="w-full pointer-events-none" style={{ height: `${BLOCK_HEIGHT}px` }} />}
        shouldRecordHeights={false}
      >
        <BlockRow
          blockId={blockId}
          showAllBlocks={showAllBlocks}
          blockUpdateHandler={blockUpdateHandler}
          handleScrollToBlock={handleScrollToBlock}
          enableAddBlock={typeof enableAddBlock === "function" ? enableAddBlock(blockId) : enableAddBlock}
          selectionHelpers={selectionHelpers}
          ganttContainerRef={ganttContainerRef}
        />
      </RenderIfVisible>
    );
  };

  return (
    <div className="absolute top-0 left-0 min-w-full w-max">
      {!groupBy || !groups || !groupedBlocks
        ? blockIds?.map(renderBlockRow)
        : groups.map((group) => {
            const groupIssueIds = groupedBlocks[group.id] || [];

            if (groupIssueIds.length === 0) return null;

            const groupKey = `${group.id ?? "none"}`;

            return (
              <div key={groupKey} className="mb-2">
                <GanttChartGroupHeader group={group} count={groupIssueIds.length} isPlaceholder />
                {groupIssueIds.map(renderBlockRow)}
              </div>
            );
          })}
    </div>
  );
}
