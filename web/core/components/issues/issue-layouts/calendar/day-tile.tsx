"use client";

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { observer } from "mobx-react";
// MobX 관련 임포트 추가
import { runInAction, transaction } from "mobx";
// types
import { TGroupedIssues, TIssue, TIssueMap, TPaginationData } from "@plane/types";
// ui
import { TOAST_TYPE, setToast } from "@plane/ui";
// components
import { CalendarIssueBlocks, ICalendarDate } from "@/components/issues";
import { highlightIssueOnDrop } from "@/components/issues/issue-layouts/utils";
// utils 파일에서 handleDragAndDrop 함수 임포트
import { handleDragAndDrop } from "./utils";
// helpers
import { MONTHS_LIST } from "@/constants/calendar";
// helpers
import { cn } from "@/helpers/common.helper";
import { renderFormattedPayloadDate } from "@/helpers/date-time.helper";
// types
import { IProjectEpicsFilter } from "@/plane-web/store/issue/epic";
import { ICycleIssuesFilter } from "@/store/issue/cycle";
import { IModuleIssuesFilter } from "@/store/issue/module";
import { IProjectIssuesFilter } from "@/store/issue/project";
import { IProjectViewIssuesFilter } from "@/store/issue/project-views";
import { TRenderQuickActions } from "../list/list-view-types";
import { useParams } from "next/navigation";
import { useIssueDetail, useIssues } from "@/hooks/store";

type Props = {
  issuesFilterStore:
    | IProjectIssuesFilter
    | IModuleIssuesFilter
    | ICycleIssuesFilter
    | IProjectViewIssuesFilter
    | IProjectEpicsFilter;
  date: ICalendarDate;
  issues: TIssueMap | undefined;
  groupedIssueIds: TGroupedIssues;
  loadMoreIssues: (dateString: string) => void;
  getPaginationData: (groupId: string | undefined) => TPaginationData | undefined;
  getGroupIssueCount: (groupId: string | undefined) => number | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  quickActions: TRenderQuickActions;
  handleDragAndDrop: (
    issueId: string | undefined,
    issueProjectId: string | undefined,
    sourceDate: string | undefined,
    destinationDate: string | undefined,
    isStartDate: boolean
  ) => Promise<void>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  readOnly?: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  issueInfo: Map<string, {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  }>;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEpic?: boolean;
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
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    quickActions,
    handleDragAndDrop,
    addIssuesToView,
    readOnly,
    selectedDate,
    setSelectedDate,
    issueInfo: propIssueInfo,
    canEditProperties,
    isEpic = false,
  } = props;

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [issueInfoMap, setIssueInfoMap] = useState(new Map());
  
  // 이전 issueInfoMap 상태를 추적하기 위한 ref
  const prevIssueInfoMapRef = useRef(new Map());

  const { workspaceSlug, projectId: rawProjectId } = useParams();
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const { updateIssue } = useIssueDetail();
  const { issue: issueStore } = useIssueDetail();

  // 처리된 이벤트 ID를 추적하기 위한 ref
  const processedEvents = useRef(new Set<string>());

  // 다른 날짜 타일에서 발생한 이슈 업데이트 이벤트 수신
  useEffect(() => {
    // 이슈 업데이트 이벤트 리스너 등록
    window.addEventListener('calendar-issue-updated', handleIssueUpdated);
    
    return () => {
      window.removeEventListener('calendar-issue-updated', handleIssueUpdated);
    };
  }, []);

  // 이슈 업데이트 이벤트 핸들러
  const handleIssueUpdated = (event: CustomEvent) => {
    const { issueId, updatedIssue, forceRender } = event.detail;
    
    // 이미 처리된 이벤트인지 확인 (중복 이벤트 방지)
    const eventId = `${issueId}-${updatedIssue?.start_date}-${updatedIssue?.target_date}`;
    if (processedEvents.current.has(eventId)) {
      return;
    }
    processedEvents.current.add(eventId);
    
    // 5초 후에 이벤트 ID 제거 (메모리 관리)
    setTimeout(() => {
      processedEvents.current.delete(eventId);
    }, 5000);
    
    // 시작일과 종료일이 같은 경우에만 로그 출력
    if (updatedIssue && updatedIssue.start_date && updatedIssue.target_date) {
      const startDate = new Date(updatedIssue.start_date).toDateString();
      const targetDate = new Date(updatedIssue.target_date).toDateString();
      
      if (startDate === targetDate) {
        console.log("[중요] day-tile - 이슈 업데이트 이벤트:", {
          issueId,
          start_date: updatedIssue.start_date,
          target_date: updatedIssue.target_date,
          forceRender
        });
      }
    }
    
    // 로컬 이슈 객체 업데이트
    if (updatedIssue && issues && issues[issueId]) {
      // MobX 트랜잭션으로 이슈 객체 업데이트
      runInAction(() => {
        // 기존 이슈 객체 복사
        const updatedIssueObj = {
          ...issues[issueId],
          ...updatedIssue
        };
        
        // 이슈 스토어에 업데이트된 이슈 객체 저장
        if (issueStore && issueStore.addIssueToStore) {
          issueStore.addIssueToStore(updatedIssueObj);
        }
      });
    }
    
    // 강제 재렌더링 트리거
    if (forceRender) {
      setUpdateTrigger(Date.now());
    }
  };

  const calendarLayout = issuesFilterStore?.issueFilters?.displayFilters?.calendar?.layout ?? "month";

  const formattedDatePayload = renderFormattedPayloadDate(date.date);

  const dayTileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = dayTileRef.current;

    if (!element) return;

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ date: formattedDatePayload }),
        onDragEnter: () => {
          setIsDraggingOver(true);
        },
        onDragLeave: () => {
          setIsDraggingOver(false);
        },
        onDrop: ({ source, self }) => {
          setIsDraggingOver(false);
          const sourceData = source?.data as { 
            id: string; 
            date: string; 
            isStartDate: boolean;
            isEqualDatesCase?: boolean;
          } | undefined;
          const destinationData = self?.data as { date: string } | undefined;
          if (!sourceData || !destinationData || !workspaceSlug || !projectId || !updateIssue) return;

          const issueDetails = issues?.[sourceData?.id];
          if (!issueDetails) return;

          const newDate = new Date(destinationData.date);

          console.log("Drop Event:", {
            sourceData,
            destinationData,
            issueDetails: {
              id: issueDetails.id,
              name: issueDetails.name,
              start_date: issueDetails.start_date,
              target_date: issueDetails.target_date
            }
          });

          // 시작일과 종료일이 같은 경우 특별 처리
          const hasBothDates = !!(issueDetails.start_date && issueDetails.target_date);
          const datesAreEqual = hasBothDates && 
            new Date(issueDetails.start_date).toDateString() === new Date(issueDetails.target_date).toDateString();

          console.log("Date equality check:", {
            hasBothDates,
            datesAreEqual,
            start_date: issueDetails.start_date ? new Date(issueDetails.start_date).toDateString() : null,
            target_date: issueDetails.target_date ? new Date(issueDetails.target_date).toDateString() : null,
            isStartDate: sourceData.isStartDate,
            isEqualDatesCase: sourceData.isEqualDatesCase
          });

          // 시작일과 종료일이 같은 경우 특별 처리
          if ((sourceData.isEqualDatesCase === true) || (datesAreEqual && sourceData.isStartDate === null)) {
            console.log("[중요] 시작일과 종료일이 같은 경우 처리");
            
            // 날짜 비교를 위해 Date 객체로 변환
            const sourceDateObj = new Date(sourceData.date);
            const destinationDateObj = new Date(destinationData.date);
            
            // 로컬 상태 업데이트를 위한 데이터 준비
            let updateData = {};
            let isStartDateFlag;
            
            // 드롭 위치가 소스 날짜보다 이전이면 시작일 업데이트
            if (destinationDateObj < sourceDateObj) {
              updateData = { start_date: destinationData.date };
              isStartDateFlag = true;
              console.log("[중요] 날짜가 같음, 목적지가 소스보다 이전 - 시작일 업데이트:", destinationData.date);
            } 
            // 드롭 위치가 소스 날짜보다 이후이면 종료일 업데이트
            else if (destinationDateObj > sourceDateObj) {
              updateData = { target_date: destinationData.date };
              isStartDateFlag = false;
              console.log("[중요] 날짜가 같음, 목적지가 소스보다 이후 - 종료일 업데이트:", destinationData.date);
            }
            // 같은 날짜로 드롭한 경우는 아무것도 하지 않음
            else {
              console.log("[중요] 날짜가 같음, 소스와 목적지가 동일 - 업데이트 불필요");
              return;
            }
            
            // 로컬 상태 업데이트
            if (Object.keys(updateData).length > 0) {
              transaction(() => {
                runInAction(() => {
                  // MobX 스토어 업데이트
                  issueStore.updateIssue(workspaceSlug.toString(), projectId, sourceData.id, updateData);
                  
                  // 로컬 issues 객체 직접 업데이트
                  if (issues && issues[sourceData.id]) {
                    issues[sourceData.id] = { ...issues[sourceData.id], ...updateData };
                  }
                });
                
                // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                  detail: { 
                    issueId: sourceData.id,
                    updatedIssue: issues?.[sourceData.id],
                    forceRender: true
                  } 
                }));
                
                // 강제 재렌더링 트리거
                setUpdateTrigger(Date.now());
              });
            }
            
            // API 호출로 서버에 반영 - 명확한 isStartDate 플래그 전달
            handleDragAndDrop(
              sourceData.id,
              issueDetails?.project_id,
              sourceData.date,
              destinationData.date,
              isStartDateFlag, // 명확한 플래그 전달
              issueDetails // 이슈 객체 직접 전달
            )
            .then(() => {
              highlightIssueOnDrop(source?.element?.id, false);
              console.log("[중요] API 호출 완료 - 날짜 업데이트 성공");
              
              // API 호출 성공 후 최종 상태 업데이트
              if (Object.keys(updateData).length > 0) {
                transaction(() => {
                  // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                  window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                    detail: { 
                      issueId: sourceData.id,
                      updatedIssue: issues?.[sourceData.id],
                      forceRender: true
                    } 
                  }));
                  
                  // 강제 재렌더링 트리거
                  setUpdateTrigger(Date.now());
                });
              }
            })
            .catch((error) => {
              console.error("[중요] API 오류 - 날짜 업데이트 실패:", error);
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Failed to update dates on server.",
              });
            });
            return;
          }

          // start_date를 변경하는 경우
          if (sourceData.isStartDate) {
            console.log("[중요] 시작일 업데이트", {
              from: issueDetails.start_date,
              to: destinationData.date,
              isStartDate: sourceData.isStartDate
            });
            
            const targetDate = issueDetails.target_date ? new Date(issueDetails.target_date) : null;

            // target_date가 있고, 새로운 start_date가 target_date보다 이후인 경우
            if (targetDate && newDate > targetDate) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Due date cannot be before the start date of the work item.",
              });
              return;
            }

            // MobX transaction을 사용하여 모든 상태 업데이트를 한 번에 처리
            transaction(() => {
              try {
                // 명시적으로 start_date만 업데이트
                const updateData = { start_date: destinationData.date };
                console.log("[중요] 시작일 업데이트 데이터:", updateData);
                
                // 로컬 상태 업데이트 전에 이슈 객체 복사
                const updatedIssue = { ...issueDetails, start_date: destinationData.date };
                
                // 로컬 상태 업데이트
                runInAction(() => {
                  // MobX 스토어 업데이트
                  issueStore.updateIssue(workspaceSlug.toString(), projectId, sourceData.id, updateData);
                  
                  // 로컬 issues 객체 직접 업데이트
                  if (issues && issues[sourceData.id]) {
                    issues[sourceData.id] = updatedIssue;
                  }
                });
                
                console.log("[중요] 로컬 상태 업데이트 완료 - 시작일");
                
                // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                  detail: { 
                    issueId: sourceData.id,
                    updatedIssue: updatedIssue,
                    forceRender: true
                  } 
                }));
                
                // 강제 재렌더링 트리거
                setUpdateTrigger(Date.now());
              } catch (error) {
                console.error("[중요] 로컬 상태 업데이트 오류 - 시작일:", error);
              }
            });

            // API 호출로 서버에 반영 - 명시적으로 start_date만 업데이트
            handleDragAndDrop(
              sourceData.id,
              issueDetails?.project_id,
              sourceData.date,
              destinationData.date,
              true, // 시작일 플래그 명확하게 전달
              issueDetails // 이슈 객체 직접 전달
            )
            .then(() => {
              highlightIssueOnDrop(source?.element?.id, false);
              console.log("[중요] API 호출 완료 - 시작일 업데이트 성공");
              
              // API 호출 성공 후 최종 상태 업데이트
              transaction(() => {
                runInAction(() => {
                  // 성공적인 API 호출 후 로컬 상태 다시 한번 업데이트
                  if (issues && issues[sourceData.id]) {
                    issues[sourceData.id] = { ...issues[sourceData.id], start_date: destinationData.date };
                  }
                });
                
                // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                  detail: { 
                    issueId: sourceData.id,
                    updatedIssue: issues?.[sourceData.id],
                    forceRender: true
                  } 
                }));
                
                // 강제 재렌더링 트리거
                setUpdateTrigger(Date.now());
              });
            })
            .catch((error) => {
              console.error("[중요] API 오류 - 시작일 업데이트 실패:", error);
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Failed to update start date on server.",
              });
            });
            
            // 이미 처리했으므로 여기서 종료
            return;
          } 
          // target_date(due date)를 변경하는 경우
          else {
            console.log("[중요] 종료일 업데이트", {
              from: issueDetails.target_date,
              to: destinationData.date,
              isStartDate: sourceData.isStartDate
            });
            
            const startDate = issueDetails.start_date ? new Date(issueDetails.start_date) : null;

            // start_date가 있고, 새로운 target_date가 start_date보다 이전인 경우
            if (startDate && newDate < startDate) {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Due date cannot be before the start date of the work item.",
              });
              return;
            }

            // MobX transaction을 사용하여 모든 상태 업데이트를 한 번에 처리
            transaction(() => {
              try {
                // 명시적으로 target_date만 업데이트
                const updateData = { target_date: destinationData.date };
                console.log("[중요] 종료일 업데이트 데이터:", updateData);
                
                // 로컬 상태 업데이트 전에 이슈 객체 복사
                const updatedIssue = { ...issueDetails, target_date: destinationData.date };
                
                // 로컬 상태 업데이트
                runInAction(() => {
                  // MobX 스토어 업데이트
                  issueStore.updateIssue(workspaceSlug.toString(), projectId, sourceData.id, updateData);
                  
                  // 로컬 issues 객체 직접 업데이트
                  if (issues && issues[sourceData.id]) {
                    issues[sourceData.id] = updatedIssue;
                  }
                });
                
                console.log("[중요] 로컬 상태 업데이트 완료 - 종료일");
                
                // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                  detail: { 
                    issueId: sourceData.id,
                    updatedIssue: updatedIssue,
                    forceRender: true
                  } 
                }));
                
                // 강제 재렌더링 트리거
                setUpdateTrigger(Date.now());
              } catch (error) {
                console.error("[중요] 로컬 상태 업데이트 오류 - 종료일:", error);
              }
            });

            // API 호출로 서버에 반영 - 명시적으로 target_date만 업데이트
            handleDragAndDrop(
              sourceData.id,
              issueDetails?.project_id,
              sourceData.date,
              destinationData.date,
              false, // 종료일 플래그 명확하게 전달
              issueDetails // 이슈 객체 직접 전달
            )
            .then(() => {
              highlightIssueOnDrop(source?.element?.id, false);
              console.log("[중요] API 호출 완료 - 종료일 업데이트 성공");
              
              // API 호출 성공 후 최종 상태 업데이트
              transaction(() => {
                runInAction(() => {
                  // 성공적인 API 호출 후 로컬 상태 다시 한번 업데이트
                  if (issues && issues[sourceData.id]) {
                    issues[sourceData.id] = { ...issues[sourceData.id], target_date: destinationData.date };
                  }
                });
                
                // 모든 날짜 타일에 대해 issueInfoMap 재계산을 위한 트리거
                window.dispatchEvent(new CustomEvent('calendar-issue-updated', { 
                  detail: { 
                    issueId: sourceData.id,
                    updatedIssue: issues?.[sourceData.id],
                    forceRender: true
                  } 
                }));
                
                // 강제 재렌더링 트리거
                setUpdateTrigger(Date.now());
              });
            })
            .catch((error) => {
              console.error("[중요] API 오류 - 종료일 업데이트 실패:", error);
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Failed to update target date on server.",
              });
            });
            
            // 이미 처리했으므로 여기서 종료
            return;
          }
          
          // 여기까지 도달하면 이슈 이동 처리 함수 호출 (위의 조건문에서 처리되지 않은 경우)
          handleIssueDrop(sourceData, destinationData, issueDetails);
        },
      })
    );
  }, [dayTileRef?.current, formattedDatePayload, issues, workspaceSlug, projectId, updateIssue]);

  if (!formattedDatePayload) return null;

  const getIssuesForDate = () => {
    const issueIds = new Set<string>();

    if (groupedIssueIds?.[formattedDatePayload]) {
      groupedIssueIds[formattedDatePayload].forEach(id => issueIds.add(id));
    }

    // 현재 날짜 설정 (시간 정보 제거)
    const currentDate = new Date(date.date);
    currentDate.setHours(0, 0, 0, 0);
    const currentTime = currentDate.getTime();

    // 날짜 범위에 있는 이슈들 수집
    Object.values(issues || {}).forEach(issue => {
      if (!issue) return;
      
      // 시작일과 종료일 설정 (시간 정보 제거)
      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;
      
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (targetDate) targetDate.setHours(0, 0, 0, 0);

      // 시작일과 종료일이 모두 있는 경우
      if (startDate && targetDate) {
        // 현재 날짜가 시작일과 종료일 사이에 있는지 확인 (시작일과 종료일 포함)
        const startTime = startDate.getTime();
        const targetTime = targetDate.getTime();
        
        if (currentTime >= startTime && currentTime <= targetTime) {
          issueIds.add(issue.id);
          
          // console.log(`Issue ${issue.id} date range check:`, {
          //   currentDate: currentDate.toISOString(),
          //   startDate: startDate.toISOString(),
          //   targetDate: targetDate.toISOString(),
          //   isInRange: true,
          //   timeComparison: {
          //     currentTime,
          //     startTime,
          //     targetTime,
          //     isAfterOrEqualStart: currentTime >= startTime,
          //     isBeforeOrEqualTarget: currentTime <= targetTime
          //   }
          // });
        }
      } 
      // 시작일만 있는 경우
      else if (startDate) {
        // 현재 날짜가 시작일과 같은지 확인
        if (currentTime === startDate.getTime()) {
          issueIds.add(issue.id);
        }
      } 
      // 종료일만 있는 경우
      else if (targetDate) {
        // 현재 날짜가 종료일과 같은지 확인
        if (currentTime === targetDate.getTime()) {
          issueIds.add(issue.id);
        }
      }
    });

    // 수집된 이슈 ID들을 정렬
    const sortedIssueIds = Array.from(issueIds).sort((a, b) => {
      const issueA = issues?.[a];
      const issueB = issues?.[b];
      
      if (!issueA || !issueB) return 0;
      
      // 시작일 기준으로 정렬
      const startDateA = issueA.start_date ? new Date(issueA.start_date).getTime() : 0;
      const startDateB = issueB.start_date ? new Date(issueB.start_date).getTime() : 0;
      
      if (startDateA !== startDateB) return startDateA - startDateB;
      
      // 시작일이 같으면 종료일 기준으로 정렬
      const targetDateA = issueA.target_date ? new Date(issueA.target_date).getTime() : 0;
      const targetDateB = issueB.target_date ? new Date(issueB.target_date).getTime() : 0;
      
      if (targetDateA !== targetDateB) return targetDateA - targetDateB;
      
      // 시작일과 종료일이 모두 같으면 이슈 ID 기준으로 정렬
      return a.localeCompare(b);
    });

    // console.log(`getIssuesForDate for ${date.date.toISOString()}:`, {
    //   issueIds: sortedIssueIds,
    //   updateTrigger
    // });

    return sortedIssueIds;
  };

  const issueIds = getIssuesForDate();

  // 이슈 정보 맵 생성 (시작일, 종료일, 연속성 여부)
  // updateTrigger가 변경될 때마다 issueInfoMap을 다시 계산
  useEffect(() => {
    // 이전 상태와 비교하여 변경이 있는 경우에만 업데이트
    const newIssueInfoMap = new Map();
    const currentIssueIds = getIssuesForDate(); // 함수 내부에서 다시 계산
    
    // 변경 여부를 추적
    let hasChanges = false;
    
    // 현재 날짜에 대한 각 이슈의 정보 계산
    currentIssueIds.forEach(id => {
      const issue = issues?.[id];
      
      if (!issue) return;
      
      // 시작일과 종료일 설정 (시간 정보 제거)
      const currentDate = new Date(date.date);
      currentDate.setHours(0, 0, 0, 0);
      
      const startDate = issue.start_date ? new Date(issue.start_date) : null;
      const targetDate = issue.target_date ? new Date(issue.target_date) : null;
      
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (targetDate) targetDate.setHours(0, 0, 0, 0);
      
      // 현재 날짜에 대한 이슈 정보 계산
      let isStartDate = false;
      let isEndDate = false;
      let isContinuous = false;
      
      // 시작일 확인
      if (startDate && currentDate.getTime() === startDate.getTime()) {
        isStartDate = true;
      }
      
      // 종료일 확인
      if (targetDate && currentDate.getTime() === targetDate.getTime()) {
        isEndDate = true;
      }
      
      // 연속된 날짜 확인
      if (startDate && targetDate) {
        const currentTime = currentDate.getTime();
        const startTime = startDate.getTime();
        const targetTime = targetDate.getTime();
        
        // 현재 날짜가 시작일과 종료일 사이에 있는 경우
        isContinuous = currentTime > startTime && currentTime < targetTime;
        
        // console.log(`Issue ${id} continuous check:`, {
        //   currentDate: currentDate.toISOString(),
        //   startDate: startDate.toISOString(),
        //   targetDate: targetDate.toISOString(),
        //   isContinuous,
        //   timeComparison: {
        //     currentTime,
        //     startTime,
        //     targetTime,
        //     isAfterStart: currentTime > startTime,
        //     isBeforeTarget: currentTime < targetTime
        //   }
        // });
      }
      
      // 새 정보 생성
      const newInfo = {
        isStartDate,
        isEndDate,
        isContinuous
      };
      
      // 이전 정보와 비교 (ref 사용)
      const prevInfo = prevIssueInfoMapRef.current.get(id);
      if (!prevInfo || 
          prevInfo.isStartDate !== newInfo.isStartDate || 
          prevInfo.isEndDate !== newInfo.isEndDate || 
          prevInfo.isContinuous !== newInfo.isContinuous) {
        hasChanges = true;
      }
      
      newIssueInfoMap.set(id, newInfo);
    });
    
    // 이전에 있었지만 현재 없는 이슈 ID가 있는지 확인
    prevIssueInfoMapRef.current.forEach((_, id) => {
      if (currentIssueIds.indexOf(id) === -1) {
        hasChanges = true;
      }
    });
    
    // updateTrigger가 변경되었을 때는 항상 업데이트 (드래그 앤 드롭 후)
    const forceUpdate = updateTrigger > 0;
    
    // 또는 컴포넌트가 처음 마운트될 때(prevIssueInfoMapRef.current.size === 0)
    // 또는 강제 업데이트가 필요할 때
    if (hasChanges || prevIssueInfoMapRef.current.size === 0 || forceUpdate) {
      // console.log("Updating issueInfoMap:", {
      //   date: date.date.toISOString(),
      //   hasChanges,
      //   forceUpdate,
      //   prevSize: prevIssueInfoMapRef.current.size,
      //   newSize: newIssueInfoMap.size,
      //   trigger: updateTrigger,
      //   newIssueInfoMap: Array.from(newIssueInfoMap.entries()).map(([id, info]) => ({
      //     id,
      //     ...info
      //   }))
      // });
      
      // 상태 업데이트
      setIssueInfoMap(newIssueInfoMap);
      
      // 현재 상태를 이전 상태로 저장
      prevIssueInfoMapRef.current = new Map(newIssueInfoMap);
      
      // 부모 컴포넌트에 issueInfo 전달 (props로 전달된 경우)
      if (propIssueInfo) {
        // 부모 컴포넌트의 issueInfo Map 업데이트
        currentIssueIds.forEach(id => {
          const info = newIssueInfoMap.get(id);
          if (info) {
            propIssueInfo.set(id, info);
          }
        });
      }
    }
  }, [issues, date.date, updateTrigger, formattedDatePayload, groupedIssueIds]); // issueInfoMap 제거

  const isToday = date.date.toDateString() === new Date().toDateString();
  const isSelectedDate = date.date.toDateString() == selectedDate.toDateString();

  const isWeekend = [0, 6].indexOf(date.date.getDay()) !== -1;
  const isMonthLayout = calendarLayout === "month";

  const normalBackground = isWeekend ? "bg-custom-background-90" : "bg-custom-background-100";
  const draggingOverBackground = isWeekend ? "bg-custom-background-80" : "bg-custom-background-90";

  // 이슈 이동 처리 함수
  const handleIssueDrop = (sourceData: any, destinationData: any, issueDetails: any) => {
    if (!sourceData || !destinationData || !issueDetails) return;

    // 드래그 중인 이슈 하이라이트 제거
    if (sourceData.element) {
      sourceData.element.classList.remove("highlight-issue");
    }

    // 소스 날짜와 목적지 날짜가 같으면 아무 작업도 하지 않음
    const sourceDate = sourceData.date;
    const destinationDate = destinationData.date;
    if (sourceDate === destinationDate) return;

    console.log("Drop Event:", {
      sourceData,
      destinationData,
      issueDetails
    });

    // 이슈 ID와 프로젝트 ID 가져오기
    const issueId = sourceData.id;
    const projectId = issueDetails?.project_id;

    // 시작일과 종료일이 같은지 확인
    const hasBothDates = !!(issueDetails?.start_date && issueDetails?.target_date);
    const datesAreEqual = hasBothDates && 
      new Date(issueDetails.start_date).toDateString() === new Date(issueDetails.target_date).toDateString();
    
    console.log("Date equality check:", {
      hasBothDates,
      datesAreEqual,
      start_date: issueDetails?.start_date ? new Date(issueDetails.start_date).toDateString() : null,
      target_date: issueDetails?.target_date ? new Date(issueDetails.target_date).toDateString() : null,
      isStartDate: sourceData.isStartDate,
      isEqualDatesCase: sourceData.isEqualDatesCase
    });

    // 소스 날짜와 목적지 날짜를 Date 객체로 변환하여 비교
    const sourceDateTime = new Date(sourceDate);
    const destinationDateTime = new Date(destinationDate);
    
    // isStartDate 결정
    let isStartDate;
    
    // 시작일과 종료일이 같은 경우 (isEqualDatesCase가 true인 경우)
    if (datesAreEqual || sourceData.isEqualDatesCase) {
      console.log("Updating both start_date and target_date (dates were equal)");
      
      // 두 날짜가 같은 경우 null로 설정하여 두 날짜 모두 업데이트
      isStartDate = null;
      console.log("Dates are equal - setting isStartDate to null to update both dates to:", destinationDate);
    } else {
      // 시작일과 종료일이 다른 경우 소스 날짜로 판단
      const isSourceStartDate = issueDetails?.start_date && 
        new Date(issueDetails.start_date).toDateString() === new Date(sourceDate).toDateString();
      
      isStartDate = isSourceStartDate;
    }

    console.log("[중요] handleIssueDrop - 최종 isStartDate 값:", isStartDate);

    // 로컬 변수를 명시적으로 전달하기 위해 변수 선언
    const finalIsStartDate = isStartDate;
    console.log("[중요] handleIssueDrop - finalIsStartDate 값:", finalIsStartDate);

    // 원본 이슈 객체 복사 (API 호출 전에 변경되지 않도록)
    const originalIssue = { ...issueDetails };
    console.log("[중요] handleIssueDrop - 원본 이슈 객체:", originalIssue);

    // 드래그앤드롭 처리 함수 호출
    handleDragAndDrop(
      issueId,
      projectId,
      sourceDate,
      destinationDate,
      finalIsStartDate, // 명시적으로 선언한 변수 사용
      originalIssue // 원본 이슈 객체 전달
    ).then(() => {
      // 드래그앤드롭 후 UI 업데이트 트리거
      setUpdateTrigger(Date.now());
      
      // 이슈 하이라이트 제거
      if (sourceData.element) {
        sourceData.element.classList.remove("highlight-issue");
      }
      
      console.log("[중요] API 호출 완료 - 날짜 업데이트 성공");
    }).catch(error => {
      console.error("Error updating issue dates:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "날짜 업데이트 실패",
        message: "이슈 날짜 업데이트 중 오류가 발생했습니다."
      });
    });
  };

  return (
    <>
      <div ref={dayTileRef} className="group relative flex h-full w-full flex-col bg-custom-background-90">
        {/* header */}
        <div
          className={`hidden flex-shrink-0 items-center justify-end px-2 py-1.5 text-right text-xs md:flex ${
            isMonthLayout // if month layout, highlight current month days
              ? date.is_current_month
                ? "font-medium"
                : "text-custom-text-300"
              : "font-medium" // if week layout, highlight all days
          } ${isWeekend ? "bg-custom-background-90" : "bg-custom-background-100"} `}
        >
          {date.date.getDate() === 1 && MONTHS_LIST[date.date.getMonth() + 1].shortTitle + " "}
          {isToday ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-custom-primary-100 text-white">
              {date.date.getDate()}
            </span>
          ) : (
            <>{date.date.getDate()}</>
          )}
        </div>

        {/* content */}
        <div className="h-full w-full hidden md:block">
          <div
            className={cn(
              `h-full w-full select-none ${isDraggingOver ? `${draggingOverBackground} opacity-70` : normalBackground}`,
              {
                "min-h-[5rem]": isMonthLayout,
              }
            )}
          >
            <CalendarIssueBlocks
              date={date.date}
              issueIdList={issueIds}
              issueInfo={issueInfoMap}
              quickActions={quickActions}
              loadMoreIssues={loadMoreIssues}
              getPaginationData={getPaginationData}
              getGroupIssueCount={getGroupIssueCount}
              isDragDisabled={readOnly}
              addIssuesToView={addIssuesToView}
              disableIssueCreation={disableIssueCreation}
              enableQuickIssueCreate={enableQuickIssueCreate}
              quickAddCallback={quickAddCallback}
              readOnly={readOnly}
              canEditProperties={canEditProperties}
              isEpic={isEpic}
            />
          </div>
        </div>

        {/* Mobile view content */}
        <div
          onClick={() => setSelectedDate(date.date)}
          className={cn(
            "text-sm py-2.5 h-full w-full font-medium mx-auto flex flex-col justify-start items-center md:hidden cursor-pointer opacity-80",
            {
              "bg-custom-background-100": !isWeekend,
            }
          )}
        >
          <div
            className={cn("size-6 flex items-center justify-center rounded-full", {
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
