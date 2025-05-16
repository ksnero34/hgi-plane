import { FC, useState, useEffect, ChangeEvent, KeyboardEvent } from "react";
import { observer } from "mobx-react";
import { Edit2, Trash2, MoreVertical, UserIcon, X } from "lucide-react";
import { IWorkspaceConfig } from "@/store/workspace-config.store";

// components
import {
  Button,
  CustomMenu,
  Tooltip,
  ToggleSwitch,
  Checkbox,
  Avatar,
  Input,
  CustomSelect
} from "@plane/ui";

interface IWorkspaceTableProps {
  workspaces: { results: IWorkspaceConfig[] } | IWorkspaceConfig[];
  handleEditWorkspace: (workspace: IWorkspaceConfig) => void;
  handleDeleteWorkspace: (configId: string) => void;
  handleCreateWorkspaceConfig: (values: {
    workspace_id: string;
    role: number;
  }) => Promise<void>;
}

// 워크스페이스 목록을 일관된 배열 형식으로 변환하는 헬퍼 함수
const getWorkspaceList = (workspaces: IWorkspaceTableProps['workspaces']): IWorkspaceConfig[] => {
  if (Array.isArray(workspaces)) return workspaces;
  return workspaces.results || [];
};

export const WorkspaceTable: FC<IWorkspaceTableProps> = observer((props) => {
  const { workspaces = { results: [] }, handleEditWorkspace, handleDeleteWorkspace, handleCreateWorkspaceConfig } = props;
  
  // 워크스페이스 목록을 한 번만 계산하여 재사용
  const workspaceList = getWorkspaceList(workspaces);
  
  // 선택된 기본 워크스페이스 ID 상태 관리
  const [selectedDefault, setSelectedDefault] = useState<string>("");
  
  // 각 워크스페이스의 역할 상태 관리 (워크스페이스 ID를 키로 사용)
  const [workspaceRoles, setWorkspaceRoles] = useState<{[key: string]: number}>(() => {
    return workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = workspace.role || 15;
      }
      return acc;
    }, {} as {[key: string]: number});
  });
  
  // 기본 워크스페이스로 설정할지 여부 (워크스페이스 ID를 키로 사용)
  const [defaultWorkspaces, setDefaultWorkspaces] = useState<{[key: string]: boolean}>(() => {
    return workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = workspace.is_default || false;
      }
      return acc;
    }, {} as {[key: string]: boolean});
  });

  // 제외할 사용자 그룹 상태 관리
  const [excludedUserGroups, setExcludedUserGroups] = useState<{[key: string]: string[]}>(() => {
    return workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = workspace.excluded_user_groups || [];
      }
      return acc;
    }, {} as {[key: string]: string[]});
  });

  // 새 그룹 입력값 관리
  const [newGroupInputs, setNewGroupInputs] = useState<{[key: string]: string}>({});

  // 워크스페이스 설정 변경 처리 함수
  const handleWorkspaceChange = async (workspace: IWorkspaceConfig) => {
    try {
      // 역할 상태 확인
      const role = workspaceRoles[(workspace as any).id || ""] || 15;
      
      // 워크스페이스 설정 생성 요청
      await handleCreateWorkspaceConfig({
        workspace_id: (workspace as any).id || "",
        role
      });
      
      // 상태 업데이트
      if ((workspace as any).id) {
        setDefaultWorkspaces(prev => ({
          ...prev,
          [(workspace as any).id || ""]: true
        }));
      }
    } catch (error) {
      console.error("워크스페이스 설정 변경 실패:", error);
      // 실패 시 상태 원복
      setSelectedDefault("");
    }
  };

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
    const workspace = workspaceList.find(w => (w as any).id === workspaceId);
    if (!workspace) return;

    try {
      // 기본 워크스페이스인 경우에만 API 호출
      if (defaultWorkspaces[workspaceId]) {
        const currentGroups = excludedUserGroups[workspaceId] || [];
        // console.log("역할 변경 시도:", { workspaceId, role, excludedGroups: currentGroups, workspace });
        
        // API 호출을 위한 워크스페이스 객체 준비
        const workspaceToUpdate = {
          ...workspace,
          id: workspaceId,
          role: role, // 명시적으로 선택된 역할 값 설정
          excluded_user_groups: currentGroups // 현재 제외된 그룹 값도 함께 전송
        };
        
        console.log("업데이트할 데이터:", workspaceToUpdate);
        
        await handleEditWorkspace(workspaceToUpdate);
        
        // API 호출 성공 후 상태 업데이트
        setWorkspaceRoles((prev) => ({ ...prev, [workspaceId]: role }));
        console.log("역할 변경 성공:", { workspaceId, newRole: role });
      } else {
        // 기본 워크스페이스가 아닌 경우 로컬 상태만 업데이트
        setWorkspaceRoles((prev) => ({ ...prev, [workspaceId]: role }));
      }
    } catch (error) {
      console.error("Error updating workspace role:", error);
      // 에러는 이미 상위 컴포넌트에서 처리됨
    }
  };

  // 사용자 그룹 제외 설정 변경 처리
  const handleExcludedGroupsChange = async (workspaceId: string, groups: string[]) => {
    const workspace = workspaceList.find(w => (w as any).id === workspaceId);
    if (!workspace) return;
    
    try {
      if (defaultWorkspaces[workspaceId]) {
        // 현재 역할 가져오기
        const currentRole = workspaceRoles[workspaceId] || 15;
        
        // 디버깅을 위한 로그 추가
        console.log("제외 그룹 변경 시도:", { workspaceId, groups: JSON.stringify(groups), role: currentRole });
        
        // API 호출을 위한 데이터 준비
        const updateData = {
          ...workspace, // 기존 워크스페이스 객체의 모든 속성 복사
          id: workspaceId,
          config_id: (workspace as any).config_id,
          role: currentRole,
          excluded_user_groups: groups
        } as IWorkspaceConfig; // IWorkspaceConfig로 타입 단언
        
        console.log("업데이트할 데이터:", JSON.stringify(updateData));
        
        // API 호출
        await handleEditWorkspace(updateData);
        
        // API 호출 성공 후 상태 업데이트
        setExcludedUserGroups((prev) => ({ ...prev, [workspaceId]: groups }));
        console.log("제외 그룹 변경 성공:", { workspaceId, groups: JSON.stringify(groups) });
      }
    } catch (error) {
      console.error("Error updating excluded user groups:", error);
    }
  };
  
  // 그룹 추가 처리
  const handleAddGroup = (workspaceId: string, group: string) => {
    if (!group.trim()) return;
    
    const currentGroups = excludedUserGroups[workspaceId] || [];
    
    // 이미 존재하는 그룹인지 확인
    if (currentGroups.includes(group.trim())) return;
    
    // 새 그룹 추가
    const updatedGroups = [...currentGroups, group.trim()];
    
    // console.log("[그룹 추가] 워크스페이스 ID:", workspaceId);
    // console.log("[그룹 추가] 추가할 그룹:", group.trim());
    // console.log("[그룹 추가] 기존 그룹:", currentGroups);
    // console.log("[그룹 추가] 업데이트된 그룹:", updatedGroups);
    
    // 로컬 상태 즉시 업데이트
    setExcludedUserGroups((prev) => ({ ...prev, [workspaceId]: updatedGroups }));
    
    // 입력 필드 초기화
    setNewGroupInputs((prev) => ({ ...prev, [workspaceId]: "" }));
    
    // API 호출로 서버에 변경사항 저장
    handleExcludedGroupsChange(workspaceId, updatedGroups);
  };
  
  // 그룹 삭제 처리
  const handleRemoveGroup = (workspaceId: string, group: string) => {
    const currentGroups = excludedUserGroups[workspaceId] || [];
    
    // 그룹 제거
    const updatedGroups = currentGroups.filter(g => g !== group);
    
    // 로컬 상태 즉시 업데이트
    setExcludedUserGroups((prev) => ({ ...prev, [workspaceId]: updatedGroups }));
    
    // API 호출로 서버에 변경사항 저장
    handleExcludedGroupsChange(workspaceId, updatedGroups);
  };
  
  // 키 입력 처리 (Enter 키로 그룹 추가)
  const handleKeyDown = (workspaceId: string, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = newGroupInputs[workspaceId] || "";
      handleAddGroup(workspaceId, value);
    }
  };

  // 기본 워크스페이스 설정 변경 처리
  const handleDefaultChange = async (checked: boolean, workspace: IWorkspaceConfig) => {
    console.log("기본 워크스페이스 설정 변경:", checked, workspace);
    
    try {
      setSelectedDefault((workspace as any).id || "");
      
      if (checked) {
        // 기본 워크스페이스로 추가
        await handleWorkspaceChange(workspace);
      } else {
        // 기본 워크스페이스에서 제거 (삭제)
        console.log("워크스페이스 삭제 시도:", workspace);
        
        if (workspace.config_id) {
          console.log("삭제할 config_id:", workspace.config_id);
          try {
            await handleDeleteWorkspace(workspace.config_id);
            console.log("워크스페이스 설정 삭제 성공");
          } catch (error) {
            console.error("워크스페이스 설정 삭제 실패:", error);
            alert("설정 삭제 중 오류가 발생했습니다. 다시 시도해주세요.");
            
            // 삭제 실패 시 토글 상태 원복
            setSelectedDefault("");
          }
        } else {
          console.error("config_id가 없습니다:", workspace);
          alert("설정을 삭제할 수 없습니다. config_id가 없습니다.");
          
          // 토글 상태 원복
          setSelectedDefault("");
        }
      }
    } catch (error) {
      console.error("설정 변경 중 오류 발생:", error);
      // 오류 발생 시 토글 상태 원복
      setSelectedDefault("");
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
    const initialDefaultState = workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = Boolean(workspace.is_default);
      }
      return acc;
    }, {} as Record<string, boolean>);
    
    const initialRoleState = workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = workspace.role || 15;
      }
      return acc;
    }, {} as Record<string, number>);

    const initialExcludedGroups = workspaceList.reduce((acc, workspace) => {
      if ((workspace as any)?.id) {
        acc[(workspace as any).id] = workspace.excluded_user_groups || [];
      }
      return acc;
    }, {} as Record<string, string[]>);
    
    // 상태 업데이트
    setDefaultWorkspaces(initialDefaultState);
    setWorkspaceRoles(initialRoleState);
    setExcludedUserGroups(initialExcludedGroups);
    
    // 콘솔에 선택된 설정 정보 로깅
    console.log("Initial default states:", initialDefaultState);
    console.log("Initial role states:", initialRoleState);
    console.log("Initial excluded groups:", initialExcludedGroups);
  }, [workspaces]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4">
        {!workspaces ? (
          <div className="text-center text-custom-text-300">
            워크스페이스 데이터를 불러올 수 없습니다.
          </div>
        ) : workspaceList.length === 0 ? (
          <div className="text-center text-custom-text-300">
            워크스페이스가 없습니다.
          </div>
        ) : (
          workspaceList.map((workspace) => {
            if (!(workspace as any)?.id) return null;
            
            const isDefault = defaultWorkspaces[(workspace as any).id] || false;
            const role = workspaceRoles[(workspace as any).id] || 15; // 기본값은 member
            const excludedGroups = excludedUserGroups[(workspace as any).id] || [];
            const newGroupInput = newGroupInputs[(workspace as any).id] || "";
            
            return (
              <div
                key={(workspace as any).id}
                className="bg-custom-background-100 border border-custom-border-200 rounded-md p-4"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 워크스페이스 정보 */}
                  <div className="flex-1 flex items-center gap-3">
                    <Avatar 
                      name={(workspace as any).name}
                      src={(workspace as any).logo_url || undefined}
                      size={56}
                      shape="square"
                    />
                    <div>
                      <h3 className="text-base font-medium">{(workspace as any).name}</h3>
                      <div className="flex items-center text-xs text-custom-text-300 mt-1">
                        <UserIcon className="h-3.5 w-3.5 mr-1" />
                        <span>{(workspace as any).total_members || 0} 멤버</span>
                      </div>
                    </div>
                  </div>

                  {/* 기본 워크스페이스 설정 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-sm font-medium">기본 워크스페이스로 추가:</h4>
                      <ToggleSwitch
                        value={isDefault}
                        onChange={(value) => handleDefaultChange(value, workspace)}
                        size="sm"
                      />
                    </div>
                    
                    {/* 역할 선택 */}
                    <div className={`mt-3 ${!isDefault ? 'opacity-60' : ''}`}>
                      <div className="text-sm font-medium mb-2">기본 멤버 권한:</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <RadioButton
                          checked={role === 20}
                          onChange={() => handleRoleChange((workspace as any).id, 20)}
                          disabled={!isDefault}
                          label="Admin"
                        />
                        
                        <RadioButton
                          checked={role === 15}
                          onChange={() => handleRoleChange((workspace as any).id, 15)}
                          disabled={!isDefault}
                          label="Member"
                        />
                        
                        <RadioButton
                          checked={role === 10}
                          onChange={() => handleRoleChange((workspace as any).id, 10)}
                          disabled={!isDefault}
                          label="Viewer"
                        />

                        <RadioButton
                          checked={role === 8}
                          onChange={() => handleRoleChange((workspace as any).id, 8)}
                          disabled={!isDefault}
                          label="Restricted"
                        />
                        
                        <RadioButton
                          checked={role === 5}
                          onChange={() => handleRoleChange((workspace as any).id, 5)}
                          disabled={!isDefault}
                          label="Guest"
                        />
                      </div>
                    </div>
                    
                    {/* 제외할 사용자 그룹 설정 */}
                    {isDefault && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2">제외할 사용자 그룹:</div>
                        
                        {/* 그룹 칩 표시 영역 */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {excludedGroups.map((group) => (
                            <div 
                              key={group} 
                              className="flex items-center gap-1 px-2 py-1 bg-custom-background-80 text-custom-text-200 rounded-md text-xs"
                            >
                              <span>{group}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup((workspace as any).id, group)}
                                className="text-custom-text-300 hover:text-custom-text-100"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        {/* 그룹 입력 필드 */}
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="사용자 그룹 입력 후 Enter"
                            value={newGroupInput}
                            onChange={(e) => setNewGroupInputs(prev => ({
                              ...prev,
                              [(workspace as any).id]: e.target.value
                            }))}
                            onKeyDown={(e) => handleKeyDown((workspace as any).id, e)}
                            className="text-sm"
                            disabled={!isDefault}
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAddGroup((workspace as any).id, newGroupInput)}
                            disabled={!newGroupInput.trim() || !isDefault}
                          >
                            추가
                          </Button>
                        </div>
                        
                        <div className="text-xs text-custom-text-300 mt-2">
                          선택한 사용자 그룹은 이 워크스페이스에 자동으로 추가되지 않습니다.
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 액션 */}
                  <div className="flex-shrink-0 flex items-start justify-end">
                    {/* 삭제 확인 팝업 대신 토글 스위치로만 처리하므로 CustomMenu 제거 */}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});