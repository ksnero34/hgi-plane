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

  let updateData: Partial<TIssue> = {};

  if (isStartDateParam === true) {
    updateData = { start_date: destinationDate };
  } else if (isStartDateParam === false) {
    updateData = { target_date: destinationDate };
  } else if (isStartDateParam === null) {
    updateData = { start_date: destinationDate, target_date: destinationDate };
  } else if (issue) {
    const isSourceStartDate = issue.start_date
      ? new Date(issue.start_date).toDateString() === new Date(sourceDate).toDateString()
      : false;
    updateData = isSourceStartDate ? { start_date: destinationDate } : { target_date: destinationDate };
  } else {
    updateData = { target_date: destinationDate };
  }

  const alreadyUpdated =
    issue &&
    ((updateData.start_date && issue.start_date === updateData.start_date) ||
      (updateData.target_date && issue.target_date === updateData.target_date));

  if (!alreadyUpdated) {
    await updateIssue(workspaceSlug, projectId, issueId, updateData);
  }

  const updatedIssue = {
    ...issue,
    ...updateData,
  };

  const event = new CustomEvent("calendar-issue-updated", {
    detail: {
      issueId,
      updatedIssue,
      forceRender: true,
    },
  });
  window.dispatchEvent(event);

  return updatedIssue;
};

export const HIGHLIGHT_CLASS = "dragging-issue";
