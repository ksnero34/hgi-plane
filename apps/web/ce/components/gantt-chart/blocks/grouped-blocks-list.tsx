import type { FC } from "react";
import { useMemo } from "react";
//
import type {
  IBlockUpdateDependencyData,
  TGroupedIssues,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
import { GanttChartGroupHeader } from "@/components/gantt-chart/blocks/group-header";
import { GanttChartBlock } from "@/components/gantt-chart/blocks/block";
import { getGroupByColumns } from "@/components/issues/issue-layouts/utils";
import { useIssues } from "@/hooks/store/use-issues";

export type GroupedGanttChartBlocksProps = {
  blockIds: string[];
  blockToRender: (data: any) => React.ReactNode;
  enableBlockLeftResize: boolean | ((blockId: string) => boolean);
  enableBlockRightResize: boolean | ((blockId: string) => boolean);
  enableBlockMove: boolean | ((blockId: string) => boolean);
  ganttContainerRef: React.RefObject<HTMLDivElement>;
  showAllBlocks: boolean;
  updateBlockDates?: (updates: IBlockUpdateDependencyData[]) => Promise<void>;
  enableDependency: boolean | ((blockId: string) => boolean);
  groupBy?: TIssueGroupByOptions | null;
  groupedIssueIds?: TGroupedIssues;
  groupByFields?: any[];
  issueTypes?: any[];
  isEpic?: boolean;
  orderBy?: TIssueOrderByOptions;
};

export const GroupedGanttChartBlocksList: FC<GroupedGanttChartBlocksProps> = (props) => {
  const {
    blockIds,
    blockToRender,
    enableBlockLeftResize,
    enableBlockRightResize,
    enableBlockMove,
    ganttContainerRef,
    showAllBlocks,
    updateBlockDates,
    enableDependency,
    groupBy,
    groupedIssueIds,
    groupByFields,
    issueTypes,
    isEpic = false,
    orderBy,
  } = props;

  const { issueMap } = useIssues();

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

  // If no grouping, render blocks normally
  if (!groupBy || !groups || !groupedBlocks) {
    return (
      <>
        {blockIds?.map((blockId) => (
          <GanttChartBlock
            key={blockId}
            blockId={blockId}
            showAllBlocks={showAllBlocks}
            blockToRender={blockToRender}
            enableBlockLeftResize={
              typeof enableBlockLeftResize === "function" ? enableBlockLeftResize(blockId) : enableBlockLeftResize
            }
            enableBlockRightResize={
              typeof enableBlockRightResize === "function" ? enableBlockRightResize(blockId) : enableBlockRightResize
            }
            enableBlockMove={typeof enableBlockMove === "function" ? enableBlockMove(blockId) : enableBlockMove}
            enableDependency={typeof enableDependency === "function" ? enableDependency(blockId) : enableDependency}
            ganttContainerRef={ganttContainerRef}
            updateBlockDates={updateBlockDates}
          />
        ))}
      </>
    );
  }

  // Render grouped blocks with group headers
  return (
    <>
      {groups.map((group) => {
        const groupIssueIds = groupedBlocks[group.id] || [];

        if (groupIssueIds.length === 0) return null;

        const groupKey = `${group.id ?? "none"}`;

        return (
          <div key={groupKey} className="mb-2">
            <GanttChartGroupHeader group={group} count={groupIssueIds.length} />

            {/* Group Blocks */}
            {groupIssueIds.map((blockId) => (
              <GanttChartBlock
                key={blockId}
                blockId={blockId}
                showAllBlocks={showAllBlocks}
                blockToRender={blockToRender}
                enableBlockLeftResize={
                  typeof enableBlockLeftResize === "function" ? enableBlockLeftResize(blockId) : enableBlockLeftResize
                }
                enableBlockRightResize={
                  typeof enableBlockRightResize === "function"
                    ? enableBlockRightResize(blockId)
                    : enableBlockRightResize
                }
                enableBlockMove={typeof enableBlockMove === "function" ? enableBlockMove(blockId) : enableBlockMove}
                enableDependency={typeof enableDependency === "function" ? enableDependency(blockId) : enableDependency}
                ganttContainerRef={ganttContainerRef}
                updateBlockDates={updateBlockDates}
              />
            ))}
          </div>
        );
      })}
    </>
  );
};
