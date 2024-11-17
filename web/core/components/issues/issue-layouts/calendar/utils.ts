import { TIssue } from "@plane/types";

export const handleDragDrop = async (
  issueId: string,
  sourceDate: string,
  destinationDate: string,
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  updateIssue?: (workspaceSlug: string, projectId: string, issueId: string, data: Partial<TIssue>) => Promise<void>,
  issue?: TIssue
) => {
  if (!workspaceSlug || !projectId || !updateIssue) return;
  if (sourceDate === destinationDate) return;

  // 드래그 시작 위치가 start_date인지 확인
  const isStartDate = issue?.start_date === sourceDate && 
    issue.start_date && 
    issue.target_date && 
    issue.start_date !== issue.target_date;

  // isStartDate에 따라 업데이트할 필드 결정
  const updateData = isStartDate
    ? { start_date: destinationDate }
    : { target_date: destinationDate };

  try {
    await updateIssue(workspaceSlug, projectId, issueId, updateData);
  } catch (error) {
    throw error;
  }
};

export const HIGHLIGHT_CLASS = "dragging-issue";
