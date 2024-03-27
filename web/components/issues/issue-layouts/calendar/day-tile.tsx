import { Droppable } from "@hello-pangea/dnd";
import { Placement } from "@popperjs/core";
import { observer } from "mobx-react-lite";
// types
import { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
// components
import { CalendarIssueBlocks, ICalendarDate, CalendarQuickAddIssueForm } from "@/components/issues";
// helpers
import { MONTHS_LIST } from "@/constants/calendar";
import { cn } from "@/helpers/common.helper";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// constants
import { ICycleIssuesFilter } from "@/store/issue/cycle";
import { IModuleIssuesFilter } from "@/store/issue/module";
import { IProjectIssuesFilter } from "@/store/issue/project";
import { IProjectViewIssuesFilter } from "@/store/issue/project-views";

type Props = {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  date: ICalendarDate;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  quickActions: (issue: TIssue, customActionButton?: React.ReactElement, placement?: Placement) => React.ReactNode;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (
    workspaceSlug: string,
    projectId: string,
    data: TIssue,
    viewId?: string
  ) => Promise<TIssue | undefined>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  viewId?: string;
  readOnly?: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

export const CalendarDayTile: React.FC<Props> = observer((props) => {
  const {
    issuesFilterStore,
    date,
    issues,
    groupedIssueIds,
    loadMoreIssues,
    getPaginationData,
    getGroupIssueCount,
    quickActions,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    addIssuesToView,
    viewId,
    readOnly = false,
    selectedDate,
    setSelectedDate,
  } = props;
  const calendarLayout = issuesFilterStore?.issueFilters?.displayFilters?.calendar?.layout ?? "month";

  const formattedDatePayload = renderFormattedPayloadDate(date.date);
  if (!formattedDatePayload) return null;
  const issueIds = groupedIssueIds?.[formattedDatePayload];
  const dayIssueCount = getGroupIssueCount(formattedDatePayload);
  const nextPageResults = getPaginationData(formattedDatePayload)?.nextPageResults;

  const shouldLoadMore =
    nextPageResults === undefined && dayIssueCount !== undefined ? issueIds?.length < dayIssueCount : !!nextPageResults;

  const isToday = date.date.toDateString() === new Date().toDateString();
  const isSelectedDate = date.date.toDateString() == selectedDate.toDateString();

  return (
    <>
      <div className="group relative flex h-full w-full flex-col bg-custom-background-90">
        {/* header */}
        <div
          className={`hidden md:flex items-center justify-end flex-shrink-0 px-2 py-1.5 text-right text-xs ${
            calendarLayout === "month" // if month layout, highlight current month days
              ? date.is_current_month
                ? "font-medium"
                : "text-custom-text-300"
              : "font-medium" // if week layout, highlight all days
          } ${
            date.date.getDay() === 0 || date.date.getDay() === 6
              ? "bg-custom-background-90"
              : "bg-custom-background-100"
          } `}
        >
          {date.date.getDate() === 1 && MONTHS_LIST[date.date.getMonth() + 1].shortTitle + " "}
          {isToday ? (
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-custom-primary-100 text-white">
              {date.date.getDate()}
            </span>
          ) : (
            <>{date.date.getDate()}</>
          )}
        </div>

        {/* content */}
        <div className="h-full w-full hidden md:block">
          <Droppable droppableId={formattedDatePayload} isDropDisabled={readOnly}>
            {(provided, snapshot) => (
              <div
                className={`h-full w-full select-none overflow-y-auto ${
                  snapshot.isDraggingOver || date.date.getDay() === 0 || date.date.getDay() === 6
                    ? "bg-custom-background-90"
                    : "bg-custom-background-100"
                } ${calendarLayout === "month" ? "min-h-[5rem]" : ""}`}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                <CalendarIssueBlocks
                  date={date.date}
                  issues={issues}
                  issueIdList={issueIds ?? []}
                  quickActions={quickActions}
                  isDragDisabled={readOnly}
                  addIssuesToView={addIssuesToView}
                  disableIssueCreation={disableIssueCreation}
                  enableQuickIssueCreate={enableQuickIssueCreate}
                  quickAddCallback={quickAddCallback}
                  viewId={viewId}
                  readOnly={readOnly}
                />

                {enableQuickIssueCreate && !disableIssueCreation && !readOnly && (
                  <div className="px-2 py-1">
                    <CalendarQuickAddIssueForm
                      formKey="target_date"
                      groupId={formattedDatePayload}
                      prePopulatedData={{
                        target_date: renderFormattedPayloadDate(date.date) ?? undefined,
                      }}
                      quickAddCallback={quickAddCallback}
                      addIssuesToView={addIssuesToView}
                      viewId={viewId}
                    />
                  </div>
                )}

                {shouldLoadMore && (
                  <div className="flex items-center px-2.5 py-1">
                    <button
                      type="button"
                      className="w-min whitespace-nowrap rounded text-xs px-1.5 py-1 text-custom-text-400 font-medium  hover:bg-custom-background-80 hover:text-custom-text-300"
                      onClick={() => loadMoreIssues(formattedDatePayload)}
                    >
                      Load More
                    </button>
                  </div>
                )}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* Mobile view content */}
        <div
          onClick={() => setSelectedDate(date.date)}
          className={cn(
            "text-sm py-2.5 h-full w-full font-medium mx-auto flex flex-col justify-start items-center md:hidden cursor-pointer",
            {
              "bg-custom-background-100": date.date.getDay() !== 0 && date.date.getDay() !== 6,
            }
          )}
        >
          <div
            className={cn("h-6 w-6  rounded-full flex items-center justify-center ", {
              "bg-custom-primary-100 text-white": isSelectedDate,
              "bg-custom-primary-100/10 text-custom-primary-100 ": isToday && !isSelectedDate,
            })}
          >
            {date.date.getDate()}
          </div>
        </div>
      </div>
    </>
  );
});
