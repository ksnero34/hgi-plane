import type { ReactNode } from "react";
import {
  RotateCcw,
  Network,
  Link as LinkIcon,
  Calendar,
  Inbox,
  AlignLeft,
  Paperclip,
  Type,
  FileText,
  Globe,
  Hash,
  Clock,
  Bell,
  LayoutGrid,
  GitBranch,
  Timer,
  ListTodo,
  Layers,
} from "lucide-react";

// components
import {
  ArchiveIcon,
  CycleIcon,
  StatePropertyIcon,
  IntakeIcon,
  ModuleIcon,
  PriorityPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
  LabelPropertyIcon,
  MembersPropertyIcon,
  EstimatePropertyIcon,
} from "@plane/propel/icons";
import { store } from "@/lib/store-context";
import type { TProjectActivity } from "@/plane-web/types";

type ActivityIconMap = {
  [key: string]: ReactNode;
};
export const iconsMap: ActivityIconMap = {
  priority: <PriorityPropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  archived_at: <ArchiveIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  restored: <RotateCcw className="h-3.5 w-3.5 text-custom-text-200" />,
  link: <LinkIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  start_date: <StartDatePropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  target_date: <DueDatePropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  label: <LabelPropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  inbox: <Inbox className="h-3.5 w-3.5 text-custom-text-200" />,
  description: <AlignLeft className="h-3.5 w-3.5 text-custom-text-200" />,
  assignee: <MembersPropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  attachment: <Paperclip className="h-3.5 w-3.5 text-custom-text-200" />,
  name: <Type className="h-3.5 w-3.5 text-custom-text-200" />,
  state: <StatePropertyIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />,
  estimate: <EstimatePropertyIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  cycle: <CycleIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />,
  module: <ModuleIcon className="h-4 w-4 flex-shrink-0 text-custom-text-200" />,
  page: <FileText className="h-3.5 w-3.5 text-custom-text-200" />,
  network: <Globe className="h-3.5 w-3.5 text-custom-text-200" />,
  identifier: <Hash className="h-3.5 w-3.5 text-custom-text-200" />,
  timezone: <Clock className="h-3.5 w-3.5 text-custom-text-200" />,
  is_project_updates_enabled: <Bell className="h-3.5 w-3.5 text-custom-text-200" />,
  is_epic_enabled: <LayoutGrid className="h-3.5 w-3.5 text-custom-text-200" />,
  is_workflow_enabled: <GitBranch className="h-3.5 w-3.5 text-custom-text-200" />,
  is_time_tracking_enabled: <Timer className="h-3.5 w-3.5 text-custom-text-200" />,
  is_issue_type_enabled: <ListTodo className="h-3.5 w-3.5 text-custom-text-200" />,
  default: <Network className="h-3.5 w-3.5 text-custom-text-200" />,
  module_view: <ModuleIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  cycle_view: <CycleIcon className="h-3.5 w-3.5 text-custom-text-200" />,
  issue_views_view: <Layers className="h-3.5 w-3.5 text-custom-text-200" />,
  page_view: <FileText className="h-3.5 w-3.5 text-custom-text-200" />,
  intake_view: <IntakeIcon className="h-3.5 w-3.5 text-custom-text-200" />,
};

export const messages = (activity: TProjectActivity): { message: string | ReactNode; customUserName?: string } => {
  const activityType = activity.field;
  const newValue = activity.new_value;
  const oldValue = activity.old_value;
  const verb = activity.verb;
  const workspaceDetail = store.workspaceRoot.getWorkspaceById(activity.workspace);

  const getBooleanActionText = (value: string | undefined) => {
    if (value === "true") return "enabled";
    if (value === "false") return "disabled";
    return verb;
  };

  switch (activityType) {
    case "priority":
      return {
        message: (
          <>
            우선순위를 <span className="font-medium text-custom-text-100">{newValue || "none"}</span>로 변경했습니다.
          </>
        ),
      };
    case "archived_at":
      return {
        message: newValue === "restore" ? "프로젝트를 복구했습니다." : "프로젝트를 보관했습니다.",
        customUserName: newValue === "archive" ? "Plane" : undefined,
      };
    case "name":
      return {
        message: (
          <>
            프로젝트 이름을 <span className="font-medium text-custom-text-100">{newValue}</span>로 변경했습니다.
          </>
        ),
      };
    case "description":
      return {
        message: newValue ? "프로젝트 설명을 변경했습니다." : "프로젝트 설명을 삭제했습니다.",
      };
    case "start_date":
      return {
        message: (
          <>
            {newValue ? (
              <>
                시작일을 <span className="font-medium text-custom-text-100">{newValue}</span>로 변경했습니다.
              </>
            ) : (
              "removed the start date"
            )}
          </>
        ),
      };
    case "target_date":
      return {
        message: (
          <>
            {newValue ? (
              <>
                종료일을 <span className="font-medium text-custom-text-100">{newValue}</span>로 변경했습니다.
              </>
            ) : (
              "removed the target date"
            )}
          </>
        ),
      };
    case "state":
      return {
        message: (
          <>
            상태를 <span className="font-medium text-custom-text-100">{newValue || "none"}</span>로 변경했습니다.
          </>
        ),
      };
    case "estimate":
      return {
        message: (
          <>
            {newValue ? (
              <>
                소요 자원을 <span className="font-medium text-custom-text-100">{newValue}</span>로 변경했습니다.
              </>
            ) : (
              <>
                소요 자원 값을 삭제했습니다.
                {oldValue && (
                  <>
                    {" "}
                    <span className="font-medium text-custom-text-100">{oldValue}</span>
                  </>
                )}
              </>
            )}
          </>
        ),
      };
    case "cycles":
      return {
        message: (
          <>
            <span>
              {verb} this project {verb === "removed" ? "from" : "to"} the cycle{" "}
            </span>
            {verb !== "removed" ? (
              <a
                href={`/${workspaceDetail?.slug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex font-medium text-custom-text-100"
              >
                {activity.new_value}
              </a>
            ) : (
              <span className="font-medium text-custom-text-100">{activity.old_value || "Unknown cycle"}</span>
            )}
          </>
        ),
      };
    case "modules":
      return {
        message: (
          <>
            <span>
              {verb} this project {verb === "removed" ? "from" : "to"} the module{" "}
            </span>
            <span className="font-medium text-custom-text-100">
              {verb === "removed" ? oldValue : newValue || "Unknown module"}
            </span>
          </>
        ),
      };
    case "labels":
      return {
        message: (
          <>
            {verb} the label{" "}
            <span className="font-medium text-custom-text-100">{newValue || oldValue || "Untitled label"}</span>
          </>
        ),
      };
    case "inbox":
      return {
        message: <>{newValue ? "enabled" : "disabled"} inbox</>,
      };
    case "page":
      return {
        message: (
          <>
            {newValue ? "created" : "removed"} the project page{" "}
            <span className="font-medium text-custom-text-100">{newValue || oldValue || "Untitled page"}</span>
          </>
        ),
      };
    case "network":
      return {
        message: <>{newValue ? "enabled" : "disabled"} network access</>,
      };
    case "identifier":
      return {
        message: (
          <>
            updated project identifier to <span className="font-medium text-custom-text-100">{newValue || "none"}</span>
          </>
        ),
      };
    case "timezone":
      return {
        message: (
          <>
            changed project timezone to{" "}
            <span className="font-medium text-custom-text-100">{newValue || "default"}</span>
          </>
        ),
      };
    case "module_view":
    case "cycle_view":
    case "issue_views_view":
    case "page_view":
    case "intake_view":
      return {
        message: (
          <>
            {getBooleanActionText(newValue)} {activityType.replace(/_view$/, "").replace(/_/g, " ")} view
          </>
        ),
      };
    case "is_project_updates_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} project updates</>,
      };
    case "is_epic_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} epics</>,
      };
    case "is_workflow_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} custom workflow</>,
      };
    case "is_time_tracking_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} time tracking</>,
      };
    case "is_issue_type_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} work item types</>,
      };
    default:
      return {
        message: `${verb} ${activityType?.replace(/_/g, " ")} `,
      };
  }
};
