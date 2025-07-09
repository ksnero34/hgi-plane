import { TIssue } from "@plane/types";

export const handleDragAndDrop = async (
  issueId: string,
  sourceDate: string,
  destinationDate: string,
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  updateIssue?: (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => Promise<void>,
  issue?: TIssue,
  isStartDateParam?: boolean | null
) => {
  if (!workspaceSlug || !projectId || !updateIssue) return;
  if (sourceDate === destinationDate) return;

  // console.log("[중요] utils - handleDragAndDrop 함수 호출됨:", {
  //   issueId,
  //   sourceDate,
  //   destinationDate,
  //   isStartDateParam,
  //   issue: issue ? {
  //     id: issue.id,
  //     name: issue.name,
  //     start_date: issue.start_date,
  //     target_date: issue.target_date
  //   } : "Issue not provided"
  // });

  // 업데이트할 데이터 결정
  let updateData: Partial<TIssue> = {};

  // isStartDateParam 값에 따라 업데이트할 필드 결정
  if (isStartDateParam === true) {
    // 시작일만 업데이트
    updateData = { start_date: destinationDate };
    // console.log("[중요] utils - 시작일만 업데이트:", updateData);
  } else if (isStartDateParam === false) {
    // 종료일만 업데이트
    updateData = { target_date: destinationDate };
    // console.log("[중요] utils - 종료일만 업데이트:", updateData);
  } else if (isStartDateParam === null) {
    // 두 날짜 모두 업데이트
    updateData = { start_date: destinationDate, target_date: destinationDate };
    // console.log("[중요] utils - 두 날짜 모두 업데이트:", updateData);
  } else {
    // isStartDateParam이 undefined인 경우 - 소스 날짜가 시작일인지 종료일인지 확인
    // console.log("[중요] utils - isStartDateParam이 undefined, 소스 날짜 확인");
    
    if (issue) {
      const isSourceStartDate = issue.start_date && 
        new Date(issue.start_date).toDateString() === new Date(sourceDate).toDateString();
      
      if (isSourceStartDate) {
        updateData = { start_date: destinationDate };
        // console.log("[중요] utils - 소스 날짜가 시작일과 일치, 시작일 업데이트:", updateData);
      } else {
        updateData = { target_date: destinationDate };
        // console.log("[중요] utils - 소스 날짜가 시작일과 일치하지 않음, 종료일 업데이트:", updateData);
      }
    } else {
      // 이슈 객체가 없는 경우 기본적으로 종료일 업데이트
      updateData = { target_date: destinationDate };
      // console.log("[중요] utils - 이슈 객체 없음, 기본적으로 종료일 업데이트:", updateData);
    }
  }

  try {
    // API 호출
    // console.log("[중요] utils - 최종 업데이트 데이터:", updateData);
    
    // 이슈 객체가 이미 업데이트된 상태인지 확인
    if (issue && 
        ((updateData.start_date && issue.start_date === updateData.start_date) || 
         (updateData.target_date && issue.target_date === updateData.target_date))) {
      // console.log("[중요] utils - 이슈 객체가 이미 업데이트된 상태입니다. API 호출 생략");
    } else {
      await updateIssue(workspaceSlug, projectId, issueId, updateData);
    }

    // 업데이트된 이슈 객체 생성
    const updatedIssue = {
      ...issue,
      ...updateData
    };

    // 이슈 업데이트 이벤트 발생
    const event = new CustomEvent("issue-updated", {
      detail: {
        issueId,
        ...updateData,
        forceRender: true
      }
    });
    window.dispatchEvent(event);

    return updatedIssue;
  } catch (error) {
    console.error("Error updating issue:", error);
    throw error;
  }
};

export const HIGHLIGHT_CLASS = "dragging-issue";
