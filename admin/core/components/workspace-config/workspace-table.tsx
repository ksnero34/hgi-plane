import { FC } from "react";
import { observer } from "mobx-react";
import { Edit2, Trash2 } from "lucide-react";

// components
import {
  Button,
  CustomMenu,
  CustomCommand,
  Tooltip,
  TotpIcon,
} from "@plane/ui";

interface IWorkspaceConfig {
  id: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: number;
}

interface IWorkspaceTableProps {
  workspaceConfigs: IWorkspaceConfig[];
  handleEditWorkspace: (workspaceConfig: IWorkspaceConfig) => void;
  handleDeleteWorkspace: (workspaceConfig: IWorkspaceConfig) => void;
}

export const WorkspaceTable: FC<IWorkspaceTableProps> = observer((props) => {
  const { workspaceConfigs, handleEditWorkspace, handleDeleteWorkspace } = props;

  const getRoleName = (role: number): string => {
    switch (role) {
      case 20:
        return "admin";
      case 15:
        return "member";
      case 10:
        return "viewer";
      case 8:
        return "restricted";
      case 5:
        return "guest";
      default:
        return "unknown";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-transparent">
        <thead>
          <tr className="border-b border-custom-border-200">
            <th className="whitespace-nowrap p-4 text-left text-sm font-medium text-custom-text-300">
              워크스페이스
            </th>
            <th className="whitespace-nowrap p-4 text-left text-sm font-medium text-custom-text-300">
              슬러그
            </th>
            <th className="whitespace-nowrap p-4 text-left text-sm font-medium text-custom-text-300">
              역할
            </th>
            <th className="whitespace-nowrap p-4 text-right text-sm font-medium text-custom-text-300">
              액션
            </th>
          </tr>
        </thead>
        <tbody>
          {workspaceConfigs.map((config) => (
            <tr
              key={config.id}
              className="border-b border-custom-border-200 hover:bg-custom-background-90"
            >
              <td className="whitespace-nowrap p-4 text-sm text-custom-text-200">
                {config.workspace.name}
              </td>
              <td className="whitespace-nowrap p-4 text-sm text-custom-text-200">
                {config.workspace.slug}
              </td>
              <td className="whitespace-nowrap p-4 text-sm text-custom-text-200">
                {getRoleName(config.role)}
              </td>
              <td className="whitespace-nowrap p-4 text-right text-sm text-custom-text-200">
                <CustomMenu
                  buttonClassName="justify-center"
                  width="auto"
                  menu={
                    <CustomCommand className="py-1 px-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-custom-text-200 hover:text-custom-text-100 px-2 py-1"
                        onClick={() => handleEditWorkspace(config)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>편집</span>
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-red-500 px-2 py-1"
                        onClick={() => handleDeleteWorkspace(config)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>삭제</span>
                      </button>
                    </CustomCommand>
                  }
                >
                  <div className="px-1.5 py-1 text-xs text-custom-text-200 hover:text-custom-text-100">
                    <TotpIcon size={14} />
                  </div>
                </CustomMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}); 