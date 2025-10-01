import { TIssueActivity } from "@plane/types";

export const getRelationActivityContent = (activity: TIssueActivity | undefined): string | undefined => {
  if (!activity) return;

  switch (activity.field) {
    case "blocking":
      return activity.old_value === "" 
        ? ` 을 차단함으로 표시했습니다: ` 
        : ` 을 차단함 표시를 제거했습니다: `;
    case "blocked_by":
      return activity.old_value === ""
        ? ` 에 의해 차단됨으로 표시했습니다: `
        : ` 에 의해 차단됨 표시를 제거했습니다: `;
    case "duplicate":
      return activity.old_value === "" 
        ? ` 의 중복임으로 표시했습니다: ` 
        : ` 의 중복임 표시를 제거했습니다: `;
    case "relates_to":
      return activity.old_value === "" 
        ? ` 과 관련있음으로 표시했습니다: ` 
        : ` 와 관련있음을 제거했습니다: `;
  }

  return;
};
