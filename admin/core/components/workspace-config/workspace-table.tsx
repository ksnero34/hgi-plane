import { FC, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Edit2, Trash2, MoreVertical, UserIcon } from "lucide-react";

// components
import {
  Button,
  CustomMenu,
  Tooltip,
  ToggleSwitch,
  Checkbox,
  Avatar
} from "@plane/ui";

interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  total_members?: number;
  is_default?: boolean;
  role?: number;
}

interface IWorkspaceTableProps {
  workspaces: IWorkspace[];
  handleEditWorkspace: (workspace: IWorkspace) => void;
  handleDeleteWorkspace: (workspace: IWorkspace) => void;
  handleCreateWorkspaceConfig: (values: {
    workspace_id: string;
    role: number;
  }) => Promise<void>;
}

export const WorkspaceTable: FC<IWorkspaceTableProps> = observer((props) => {
  const { workspaces, handleEditWorkspace, handleDeleteWorkspace, handleCreateWorkspaceConfig } = props;
  
  // 각 워크스페이스의 역할 상태 관리 (워크스페이스 ID를 키로 사용)
  const [workspaceRoles, setWorkspaceRoles] = useState<{[key: string]: number}>(() => {
    // 초기값으로 현재 역할 설정
    const initialState: {[key: string]: number} = {};
    workspaces.forEach((workspace) => {
      initialState[workspace.id] = workspace.role || 15;
    });
    return initialState;
  });
  
  // 기본 워크스페이스로 설정할지 여부 (워크스페이스 ID를 키로 사용)
  const [defaultWorkspaces, setDefaultWorkspaces] = useState<{[key: string]: boolean}>(() => {
    // 초기값으로 현재 기본 워크스페이스 설정
    const initialState: {[key: string]: boolean} = {};
    workspaces.forEach((workspace) => {
      initialState[workspace.id] = workspace.is_default || false;
    });
    return initialState;
  });

  const getRoleName = (role: number): string => {
    switch (role) {
      case 20:
        return "관리자";
      case 15:
        return "멤버";
      case 10:
        return "뷰어";
      case 8:
        return "제한됨";
      case 5:
        return "게스트";
      default:
        return "알 수 없음";
    }
  };
  
  // 워크스페이스 역할 변경 처리
  const handleRoleChange = async (workspaceId: string, role: number) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    try {
      // 먼저 상태 업데이트
      setWorkspaceRoles((prev) => ({ ...prev, [workspaceId]: role }));

      // 기본 워크스페이스인 경우에만 API 호출
      if (defaultWorkspaces[workspaceId]) {
        console.log("Updating workspace role:", { workspaceId, role });
        await handleEditWorkspace({
          ...workspace,
          id: workspaceId,  // 워크스페이스 ID 전달
          role
        });
      }
    } catch (error) {
      console.error("Error updating workspace role:", error);
      // 에러 발생 시 이전 상태로 롤백
      setWorkspaceRoles((prev) => ({ ...prev, [workspaceId]: workspace.role || 15 }));
    }
  };

  // 기본 워크스페이스 설정 변경 처리
  const handleDefaultChange = async (workspaceId: string, checked: boolean) => {
    // 먼저 상태 업데이트
    setDefaultWorkspaces((prev) => ({ ...prev, [workspaceId]: checked }));
    
    try {
      if (checked) {
        // 추가
        const role = workspaceRoles[workspaceId] || 15; // 기본값은 member
        await handleCreateWorkspaceConfig({
          workspace_id: workspaceId,
          role
        });
      } else {
        // 삭제
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (!workspace) return;

        await handleDeleteWorkspace(workspace);
        
        // 삭제 후 상태 초기화
        setWorkspaceRoles((prev) => {
          const newState = { ...prev };
          newState[workspaceId] = 15; // 기본값으로 초기화
          return newState;
        });
      }
    } catch (error) {
      console.error("Error updating workspace default status:", error);
      // 에러 발생 시 이전 상태로 롤백
      setDefaultWorkspaces((prev) => ({ ...prev, [workspaceId]: !checked }));
    }
  };
  
  // 라디오 버튼 컴포넌트
  const RadioButton = ({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer ${checked ? 'bg-custom-primary-10' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-custom-background-90'}`} onClick={disabled ? undefined : onChange}>
      <div 
        className={`relative flex items-center justify-center size-4 rounded-full border ${checked 
          ? 'border-custom-primary-100 bg-custom-primary-100' 
          : 'border-custom-border-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {checked && <div className="size-2 rounded-full bg-white"></div>}
      </div>
      <span className={`text-sm whitespace-nowrap ${disabled ? 'text-custom-text-300' : 'text-custom-text-200'}`}>{label}</span>
    </div>
  );

  // 워크스페이스별 기본 설정 상태 초기화
  useEffect(() => {
    // 워크스페이스 ID별로 기본 설정 상태 초기화
    const initialDefaultState: Record<string, boolean> = {};
    const initialRoleState: Record<string, number> = {};
    
    // 모든 워크스페이스에 대해 설정 초기화
    workspaces.forEach((workspace) => {
      initialDefaultState[workspace.id] = Boolean(workspace.is_default);
      initialRoleState[workspace.id] = workspace.is_default ? (workspace.role || 15) : 15; // 기본은 멤버 역할
    });
    
    // 상태 업데이트
    setDefaultWorkspaces(initialDefaultState);
    setWorkspaceRoles(initialRoleState);
    
    // 콘솔에 선택된 설정 정보 로깅
    console.log("Initial default states:", initialDefaultState);
    console.log("Initial role states:", initialRoleState);
  }, [workspaces]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4">
        {workspaces.map((workspace) => {
          const isDefault = defaultWorkspaces[workspace.id] || false;
          const role = workspaceRoles[workspace.id] || 15; // 기본값은 member
          
          return (
            <div
              key={workspace.id}
              className="bg-custom-background-100 border border-custom-border-200 rounded-md p-4"
            >
              <div className="flex flex-col md:flex-row gap-4">
                {/* 워크스페이스 정보 */}
                <div className="flex-1 flex items-center gap-3">
                  <Avatar 
                    name={workspace.name}
                    src={workspace.logo_url}
                    size={56}
                    shape="square"
                  />
                  <div>
                    <h3 className="text-base font-medium">{workspace.name}</h3>
                    <div className="flex items-center text-xs text-custom-text-300 mt-1">
                      <UserIcon className="h-3.5 w-3.5 mr-1" />
                      <span>{workspace.total_members || 0} 멤버</span>
                    </div>
                  </div>
                </div>

                {/* 기본 워크스페이스 설정 */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-medium">기본 워크스페이스로 추가:</h4>
                    <ToggleSwitch
                      value={isDefault}
                      onChange={(value) => handleDefaultChange(workspace.id, value)}
                      size="sm"
                    />
                  </div>
                  
                  {/* 역할 선택 */}
                  <div className={`mt-3 ${!isDefault ? 'opacity-60' : ''}`}>
                    <div className="text-sm font-medium mb-2">기본 멤버 권한:</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RadioButton
                        checked={role === 20}
                        onChange={() => handleRoleChange(workspace.id, 20)}
                        disabled={!isDefault}
                        label="Admin"
                      />
                      
                      <RadioButton
                        checked={role === 15}
                        onChange={() => handleRoleChange(workspace.id, 15)}
                        disabled={!isDefault}
                        label="Member"
                      />
                      
                      <RadioButton
                        checked={role === 10}
                        onChange={() => handleRoleChange(workspace.id, 10)}
                        disabled={!isDefault}
                        label="Viewer"
                      />

                      <RadioButton
                        checked={role === 8}
                        onChange={() => handleRoleChange(workspace.id, 8)}
                        disabled={!isDefault}
                        label="Restricted"
                      />
                      
                      <RadioButton
                        checked={role === 5}
                        onChange={() => handleRoleChange(workspace.id, 5)}
                        disabled={!isDefault}
                        label="Guest"
                      />
                    </div>
                  </div>
                </div>
                
                {/* 액션 */}
                <div className="flex-shrink-0 flex items-start justify-end">
                  {isDefault && (
                    <CustomMenu
                      buttonClassName="justify-center h-7 w-7"
                      width="auto"
                      ellipsis
                      menu={
                        <div className="py-1 px-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-red-500 px-2 py-1"
                            onClick={() => handleDeleteWorkspace(workspace)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>삭제</span>
                          </button>
                        </div>
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}); 