import { observer } from "mobx-react";
import { X, Calendar, Tag as TagIcon, User, Users, MessageSquare } from "lucide-react";
import type { TCustomField } from "@plane/types";
// ui
import { Avatar } from "@plane/ui";
// hooks
import { useMember } from "@/hooks/store/use-member";
// helpers
import { getFileURL } from "@plane/utils";

type Props = {
  appliedFilters: { [field_id: string]: string[] };
  customFields: TCustomField[];
  editable: boolean;
  handleRemove: (fieldId: string, value: string) => void;
  workspaceSlug?: string;
  projectId?: string;
};

export const AppliedCustomFieldFilters: React.FC<Props> = observer((props) => {
  const { appliedFilters, customFields, editable, handleRemove, workspaceSlug, projectId } = props;

  // hooks
  const {
    project: { getProjectMemberDetails },
  } = useMember();

  const getCustomField = (fieldId: string) => {
    return customFields.find((field) => field.id === fieldId);
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
      case "multiselect":
        return <TagIcon className="h-3 w-3 flex-shrink-0" />;
      case "date":
        return <Calendar className="h-3 w-3 flex-shrink-0" />;
      case "project_member":
        return <User className="h-3 w-3 flex-shrink-0" />;
      case "project_members":
        return <Users className="h-3 w-3 flex-shrink-0" />;
      case "text":
        return <MessageSquare className="h-3 w-3 flex-shrink-0" />;
      default:
        return <TagIcon className="h-3 w-3 flex-shrink-0" />;
    }
  };

  const formatValue = (value: string, field: TCustomField) => {
    // 날짜 필터의 경우 사용자 친화적인 형태로 변환
    if (field.field_type === "date") {
      if (value.indexOf(";") !== -1) {
        const parts = value.split(";");
        if (parts.length >= 2) {
          const [duration, timeframe] = parts;
          if (duration.indexOf("_") !== -1) {
            const [num, unit] = duration.split("_");
            const unitText = unit === "weeks" ? "주일" : unit === "months" ? "개월" : unit === "days" ? "일" : unit;
            if (timeframe === "within") {
              return `다음 ${num}${unitText}`;
            } else if (timeframe === "after") {
              return `${num}${unitText} 이후`;
            } else if (timeframe === "before") {
              return `지난 ${num}${unitText}`;
            }
          }
        }
      }
      // 커스텀 날짜인 경우
      if (value.indexOf("-") !== -1) {
        return value; // 실제 날짜 형식
      }
    }

    // project_member나 project_members의 경우 ID를 이름으로 변환
    if (field.field_type === "project_member" || field.field_type === "project_members") {
      // projectId가 없으면 UUID 축약 형태로 반환
      if (!projectId) {
        return `${value.substring(0, 8)}...`;
      }

      // 프로젝트 멤버에서 찾기
      const projectMemberDetails = getProjectMemberDetails(value, projectId);
      if (projectMemberDetails?.member?.display_name) {
        return projectMemberDetails.member.display_name;
      }
      if (projectMemberDetails?.member?.first_name) {
        return projectMemberDetails.member.first_name;
      }
      if (projectMemberDetails?.member?.email) {
        return projectMemberDetails.member.email;
      }

      // 찾지 못한 경우 UUID를 짧게 표시
      return `${value.substring(0, 8)}...`;
    }

    return value;
  };

  // 멤버 아바타를 렌더링하는 함수
  const renderMemberAvatar = (value: string, field: TCustomField) => {
    if (!projectId) return null;

    const projectMemberDetails = getProjectMemberDetails(value, projectId);
    if (!projectMemberDetails?.member) return null;

    return (
      <Avatar
        name={projectMemberDetails.member.display_name || projectMemberDetails.member.first_name || "Unknown"}
        src={getFileURL(projectMemberDetails.member.avatar_url ?? "")}
        showTooltip={false}
        size="sm"
      />
    );
  };

  return (
    <>
      {Object.entries(appliedFilters).map(([fieldId, values]) => {
        if (!values || values.length === 0) return null;

        const field = getCustomField(fieldId);
        if (!field) return null;

        return values.map((value) => (
          <div
            key={`${fieldId}-${value}`}
            className="flex items-center gap-1 rounded bg-custom-background-80 px-1 py-0.5 text-xs"
          >
            {/* 멤버 필드인 경우 아바타로 표시, 아니면 아이콘 표시 */}
            {field.field_type === "project_member" || field.field_type === "project_members"
              ? renderMemberAvatar(value, field) || getFieldIcon(field.field_type)
              : getFieldIcon(field.field_type)}
            <span className="text-custom-text-200">{formatValue(value, field)}</span>
            {editable && (
              <button
                type="button"
                className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                onClick={() => handleRemove(fieldId, value)}
              >
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>
        ));
      })}
    </>
  );
});
