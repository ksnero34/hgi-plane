import { MutableRefObject } from "react";
import { observer } from "mobx-react-lite";
import {
  GroupByColumnTypes,
  IGroupByColumn,
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  IIssueMap,
  TSubGroupedIssues,
  TIssueKanbanFilters,
  TPaginationData,
} from "@plane/types";
// components
import { useCycle, useLabel, useMember, useModule, useProject, useProjectState } from "@/hooks/store";
import { getGroupByColumns, isWorkspaceLevel } from "../utils";
import { KanbanStoreType } from "./base-kanban-root";
import { KanBan } from "./default";
import { HeaderGroupByCard } from "./headers/group-by-card";
import { HeaderSubGroupByCard } from "./headers/sub-group-by-card";
// types
// constants

interface ISubGroupSwimlaneHeader {
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  sub_group_by: string | null;
  group_by: string | null;
  list: IGroupByColumn[];
  kanbanFilters: TIssueKanbanFilters;
  handleKanbanFilters: (toggle: "group_by" | "sub_group_by", value: string) => void;
  storeType: KanbanStoreType;
  showEmptyGroup: boolean;
}

const visibilitySubGroupByGroupCount = (
  subGroupIssueCount: number,
  showEmptyGroup: boolean
): boolean => {
  let subGroupHeaderVisibility = true;

  if (showEmptyGroup) subGroupHeaderVisibility = true;
  else {
    if (subGroupIssueCount > 0) subGroupHeaderVisibility = true;
    else subGroupHeaderVisibility = false;
  }

  return subGroupHeaderVisibility;
};

const SubGroupSwimlaneHeader: React.FC<ISubGroupSwimlaneHeader> = observer(({
  getGroupIssueCount,  sub_group_by,
  group_by,
  storeType,
  list,
  kanbanFilters,
  handleKanbanFilters,
  showEmptyGroup,
}) => (
  <div className="relative flex h-max min-h-full w-full items-center gap-2">
    {list &&
      list.length > 0 &&
      list.map((_list: IGroupByColumn) => {
        const groupCount = getGroupIssueCount(_list?.id, undefined, false) ?? 0;

        const subGroupByVisibilityToggle = visibilitySubGroupByGroupCount(
          groupCount,
          showEmptyGroup
        );

        if (subGroupByVisibilityToggle === false) return <></>;

        return (
          <div key={`${sub_group_by}_${_list.id}`} className="flex w-[350px] flex-shrink-0 flex-col">
            <HeaderGroupByCard
              sub_group_by={sub_group_by}
              group_by={group_by}
              column_id={_list.id}
              icon={_list.icon}
              title={_list.name}
              count={groupCount}
              kanbanFilters={kanbanFilters}
              handleKanbanFilters={handleKanbanFilters}
              issuePayload={_list.payload}
              storeType={storeType}
            />
          </div>
        )})}
    </div>
  )
);

interface ISubGroupSwimlane extends ISubGroupSwimlaneHeader {
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  getPaginationData: (groupId: string | undefined, subGroupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  showEmptyGroup: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue:
    | ((projectId: string | null | undefined, issueId: string, data: Partial<TIssue>) => Promise<void>)
    | undefined;
  quickActions: (issue: TIssue, customActionButton?: React.ReactElement) => React.ReactNode;
  kanbanFilters: TIssueKanbanFilters;
  handleKanbanFilters: (toggle: "group_by" | "sub_group_by", value: string) => void;
  isDragStarted?: boolean;
  disableIssueCreation?: boolean;
  storeType: KanbanStoreType;
  enableQuickIssueCreate: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  quickAddCallback?: (
    workspaceSlug: string,
    projectId: string,
    data: TIssue,
    viewId?: string
  ) => Promise<TIssue | undefined>;
  viewId?: string;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
}

const SubGroupSwimlane: React.FC<ISubGroupSwimlane> = observer((props) => {
  const {
    issuesMap,
    groupedIssueIds,
    getGroupIssueCount,
    getPaginationData,
    sub_group_by,
    group_by,
    list,
    storeType,
    updateIssue,
    quickActions,
    displayProperties,
    kanbanFilters,
    handleKanbanFilters,
    loadMoreIssues,
    showEmptyGroup,
    enableQuickIssueCreate,
    canEditProperties,
    addIssuesToView,
    quickAddCallback,
    viewId,
    scrollableContainerRef,
    isDragStarted,
  } = props;

  const visibilitySubGroupBy = (_list: IGroupByColumn, subGroupCount: number): { showGroup: boolean; showIssues: boolean } => {
    const subGroupVisibility = {
      showGroup: true,
      showIssues: true,
    };
    if (showEmptyGroup) subGroupVisibility.showGroup = true;
    else {
      if (subGroupCount > 0) subGroupVisibility.showGroup = true;
      else subGroupVisibility.showGroup = false;
    }
    if (kanbanFilters?.sub_group_by.includes(_list.id)) subGroupVisibility.showIssues = false;
    return subGroupVisibility;
  };

  return (
    <div className="relative h-max min-h-full w-full">
      {list &&
        list.length > 0 &&
        list.map((_list: any) => {
          const issueCount = getGroupIssueCount(undefined, _list.id, true) ?? 0;
          const subGroupByVisibilityToggle = visibilitySubGroupBy(_list, issueCount);
          if (subGroupByVisibilityToggle.showGroup === false) return <></>;
          return (
            <div key={_list.id} className="flex flex-shrink-0 flex-col">
              <div className="sticky top-[50px] z-[1] flex w-full items-center bg-custom-background-90 py-1">
                <div className="sticky left-0 flex-shrink-0 bg-custom-background-90 pr-2">
                  <HeaderSubGroupByCard
                    column_id={_list.id}
                    icon={_list.Icon}
                    title={_list.name || ""}
                    count={issueCount}
                    kanbanFilters={kanbanFilters}
                    handleKanbanFilters={handleKanbanFilters}
                  />
                </div>
                <div className="w-full border-b border-dashed border-custom-border-400" />
              </div>

              {subGroupByVisibilityToggle.showIssues && (
                <div className="relative">
                  <KanBan
                    issuesMap={issuesMap}
                    groupedIssueIds={groupedIssueIds}
                    getGroupIssueCount={getGroupIssueCount}
                    getPaginationData={getPaginationData}
                    displayProperties={displayProperties}
                    sub_group_by={sub_group_by}
                    group_by={group_by}
                    sub_group_id={_list.id}
                    storeType={storeType}
                    updateIssue={updateIssue}
                    quickActions={quickActions}
                    kanbanFilters={kanbanFilters}
                    handleKanbanFilters={handleKanbanFilters}
                    showEmptyGroup={showEmptyGroup}
                    enableQuickIssueCreate={enableQuickIssueCreate}
                    canEditProperties={canEditProperties}
                    addIssuesToView={addIssuesToView}
                    quickAddCallback={quickAddCallback}
                    viewId={viewId}
                    scrollableContainerRef={scrollableContainerRef}
                    isDragStarted={isDragStarted}
                    loadMoreIssues={loadMoreIssues}
                  />
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
});

export interface IKanBanSwimLanes {
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  getPaginationData: (groupId: string | undefined, subGroupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  sub_group_by: string | null;
  group_by: string | null;
  updateIssue:
    | ((projectId: string | null | undefined, issueId: string, data: Partial<TIssue>) => Promise<void>)
    | undefined;
  quickActions: (issue: TIssue, customActionButton?: React.ReactElement) => React.ReactNode;
  kanbanFilters: TIssueKanbanFilters;
  handleKanbanFilters: (toggle: "group_by" | "sub_group_by", value: string) => void;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  showEmptyGroup: boolean;
  isDragStarted?: boolean;
  disableIssueCreation?: boolean;
  storeType: KanbanStoreType;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  enableQuickIssueCreate: boolean;
  quickAddCallback?: (
    workspaceSlug: string,
    projectId: string,
    data: TIssue,
    viewId?: string
  ) => Promise<TIssue | undefined>;
  viewId?: string;
  canEditProperties: (projectId: string | undefined) => boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
}

export const KanBanSwimLanes: React.FC<IKanBanSwimLanes> = observer((props) => {
  const {
    issuesMap,
    groupedIssueIds,
    getGroupIssueCount,
    getPaginationData,
    displayProperties,
    sub_group_by,
    group_by,
    updateIssue,
    storeType,
    quickActions,
    kanbanFilters,
    handleKanbanFilters,
    loadMoreIssues,
    showEmptyGroup,
    isDragStarted,
    disableIssueCreation,
    enableQuickIssueCreate,
    canEditProperties,
    addIssuesToView,
    quickAddCallback,
    viewId,
    scrollableContainerRef,
  } = props;

  const member = useMember();
  const project = useProject();
  const label = useLabel();
  const cycle = useCycle();
  const projectModule = useModule();
  const projectState = useProjectState();

  const groupByList = getGroupByColumns(
    group_by as GroupByColumnTypes,
    project,
    cycle,
    projectModule,
    label,
    projectState,
    member,
    true,
    isWorkspaceLevel(storeType)
  );
  const subGroupByList = getGroupByColumns(
    sub_group_by as GroupByColumnTypes,
    project,
    cycle,
    projectModule,
    label,
    projectState,
    member,
    true,
    isWorkspaceLevel(storeType)
  );

  if (!groupByList || !subGroupByList) return null;

  return (
    <div className="relative">
      <div className="sticky top-0 z-[2] h-[50px] bg-custom-background-90">
        <SubGroupSwimlaneHeader
          getGroupIssueCount={getGroupIssueCount}
          group_by={group_by}
          sub_group_by={sub_group_by}
          kanbanFilters={kanbanFilters}
          handleKanbanFilters={handleKanbanFilters}
          list={groupByList}
          storeType={storeType}
          showEmptyGroup={showEmptyGroup}
        />
      </div>

      {sub_group_by && (
        <SubGroupSwimlane
          issuesMap={issuesMap}
          list={subGroupByList}
          groupedIssueIds={groupedIssueIds}
          getPaginationData={getPaginationData}
          getGroupIssueCount={getGroupIssueCount}
          displayProperties={displayProperties}
          group_by={group_by}
          sub_group_by={sub_group_by}
          updateIssue={updateIssue}
          quickActions={quickActions}
          kanbanFilters={kanbanFilters}
          handleKanbanFilters={handleKanbanFilters}
          loadMoreIssues={loadMoreIssues}
          showEmptyGroup={showEmptyGroup}
          isDragStarted={isDragStarted}
          disableIssueCreation={disableIssueCreation}
          enableQuickIssueCreate={enableQuickIssueCreate}
          addIssuesToView={addIssuesToView}
          canEditProperties={canEditProperties}
          quickAddCallback={quickAddCallback}
          viewId={viewId}
          scrollableContainerRef={scrollableContainerRef}
          storeType={storeType}
        />
      )}
    </div>
  );
});
