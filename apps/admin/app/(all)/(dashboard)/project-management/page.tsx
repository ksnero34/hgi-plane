import { useState, useEffect } from "react";
import axios from "axios";
import { observer } from "mobx-react";
import { useRouter, usePathname } from "next/navigation";
// 서비스 임포트
import { InstanceService, InstanceWorkspaceService } from "@plane/services";
// components
import { Button, CustomSelect, Loader } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

// hooks
import { useAuth } from "@/hooks/store";

const ProjectManagementPage = observer(() => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const instanceWorkspaceService = new InstanceWorkspaceService();

  // 상태 관리
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedSourceWorkspace, setSelectedSourceWorkspace] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTargetWorkspace, setSelectedTargetWorkspace] = useState<string | null>(null);

  // 직접 인스턴스 관리자 API 호출로 인증 체크
  useEffect(() => {
    // 페이지 로드 즉시 직접 API 호출하여 401 에러 발생시키기
    // // console.log("General 페이지: 직접 API 호출로 인증 체크");
    axios
      .get("/api/instances/admins/", { withCredentials: true })
      .then((response) => {
        // // console.log("General 페이지: 관리자 API 호출 성공", response.data);
      })
      .catch((error: any) => {
        // // console.log("General 페이지: 관리자 API 호출 오류", error);
        // 401 에러 발생 시 리다이렉션
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          const normalizedPath = currentPath.replace(/^\/god-mode/, "");
          window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
        }
      });
  }, []);

  // CSRF 토큰 가져오기
  const getCSRFToken = async () => {
    try {
      // CSRF 토큰 요청
      const response = await axios.get("/auth/get-csrf-token/", {
        withCredentials: true,
      });

      if (response.data && response.data.csrf_token) {
        return response.data.csrf_token;
      } else {
        console.error("CSRF 토큰 데이터가 올바르지 않습니다:", response);
        throw new Error("CSRF 토큰을 가져올 수 없습니다.");
      }
    } catch (error: any) {
      console.error("CSRF 토큰 요청 실패:", error);
      // 401 에러 처리
      if (error?.response?.status === 401) {
        handleAuthError();
      }
      throw error;
    }
  };

  // 인증 에러 처리
  const handleAuthError = () => {
    router.push(`/?next_path=${pathname}`);
  };

  // useEffect로 워크스페이스 목록 가져오기
  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchWorkspaces();
    }
  }, [authLoading, isAdmin]);

  // 선택된 워크스페이스에서 프로젝트 목록 가져오기
  useEffect(() => {
    if (selectedSourceWorkspace) {
      fetchProjects(selectedSourceWorkspace);
    }
  }, [selectedSourceWorkspace]);

  // 초기 상태 설정 개선
  useEffect(() => {
    if (workspaces.length > 0 && !selectedSourceWorkspace) {
      // console.log("자동으로 첫 번째 워크스페이스 선택:", workspaces[0].id);
      setSelectedSourceWorkspace(workspaces[0].id);
      fetchProjects(workspaces[0].id);
    }
  }, [workspaces]);

  // 워크스페이스 목록 불러오기
  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);

      // InstanceWorkspaceService를 사용하여 워크스페이스 목록 가져오기
      const workspaceData = await instanceWorkspaceService.list();
      // console.log("워크스페이스 목록 응답:", workspaceData);

      if (workspaceData && workspaceData.results) {
        setWorkspaces(workspaceData.results);
      } else {
        console.error("워크스페이스 정보를 찾을 수 없습니다.");
        setWorkspaces([]);
      }
    } catch (error: any) {
      console.error("워크스페이스 불러오기 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "워크스페이스를 불러오는 중 오류가 발생했습니다.",
      });

      // 401 에러 처리
      if (error?.response?.status === 401) {
        handleAuthError();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 프로젝트 목록 불러오기
  const fetchProjects = async (workspaceId: string) => {
    try {
      setIsLoading(true);
      // 선택된 워크스페이스 찾기
      const selectedWorkspace = workspaces.find((w) => w.id === workspaceId);
      if (!selectedWorkspace) {
        console.error("선택한 워크스페이스를 찾을 수 없습니다.");
        setProjects([]);
        setIsLoading(false);
        return;
      }

      // console.log("선택된 워크스페이스:", selectedWorkspace);

      try {
        // CSRF 토큰 가져오기
        const csrfToken = await getCSRFToken();

        // 인스턴스 관리자용 프로젝트 목록 API 호출
        const url = `/api/instances/workspaces/${selectedWorkspace.slug}/projects/`;
        // console.log("프로젝트 목록 요청 URL:", url);

        const response = await axios.get(url, {
          headers: {
            "X-CSRFToken": csrfToken,
          },
          withCredentials: true,
        });

        // console.log("프로젝트 API 응답:", response);

        if (response.data) {
          const projectData = Array.isArray(response.data) ? response.data : [];
          // console.log("프로젝트 목록:", projectData);
          setProjects(projectData);

          // 상태 업데이트 (선택된 워크스페이스 표시)
          setSelectedSourceWorkspace(workspaceId);
        } else {
          console.error("프로젝트 데이터를 불러올 수 없습니다:", response);
          setProjects([]);
        }
      } catch (error: any) {
        console.error("프로젝트 목록 API 요청 실패:", error);

        if (error?.response?.status === 401) {
          console.error("인증 오류가 발생했습니다. 관리자 권한이 필요합니다.");
          handleAuthError();
        } else {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "오류",
            message: "프로젝트 목록을 불러오는데 실패했습니다.",
          });
        }

        setProjects([]);
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error("프로젝트 불러오기 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "프로젝트를 불러오는 중 오류가 발생했습니다.",
      });

      setIsLoading(false);
    }
  };

  // 선택된 프로젝트 변경 핸들러
  const handleProjectChange = (projectId: string) => {
    // console.log("프로젝트 선택됨:", projectId);
    setSelectedProject(projectId);
  };

  // 대상 워크스페이스 변경 핸들러
  const handleTargetWorkspaceChange = (workspaceId: string) => {
    // console.log("대상 워크스페이스 선택됨:", workspaceId);
    setSelectedTargetWorkspace(workspaceId);
  };

  // 프로젝트 이동 처리
  const handleProjectTransfer = async () => {
    // 필수 데이터 유효성 검사
    if (!selectedSourceWorkspace || !selectedProject || !selectedTargetWorkspace) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "입력 오류",
        message: "소스 워크스페이스, 프로젝트, 대상 워크스페이스를 모두 선택해주세요.",
      });
      return;
    }

    // 같은 워크스페이스로 이동 시도 시 경고
    if (selectedSourceWorkspace === selectedTargetWorkspace) {
      setToast({
        type: TOAST_TYPE.WARNING,
        title: "경고",
        message: "프로젝트가 이미 해당 워크스페이스에 있습니다.",
      });
      return;
    }

    // 사용자 확인
    if (!confirm("정말 이 프로젝트를 다른 워크스페이스로 이동하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    try {
      setIsTransferring(true);

      // CSRF 토큰 가져오기
      const csrfToken = await getCSRFToken();

      // 프로젝트 이동 요청
      const selectedWorkspace = workspaces.find((w) => w.id === selectedSourceWorkspace);
      const url = `/api/instances/workspaces/${selectedWorkspace?.slug}/projects/`;

      const response = await axios.post(
        url,
        {
          project_id: selectedProject,
          target_workspace_id: selectedTargetWorkspace,
        },
        {
          headers: {
            "X-CSRFToken": csrfToken,
          },
          withCredentials: true,
        }
      );

      // console.log("프로젝트 이동 결과:", response);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공",
        message: "프로젝트가 성공적으로 이동되었습니다.",
      });

      // 상태 초기화 및 UI 업데이트
      setSelectedProject(null);
      setProjects([]);

      // 프로젝트 목록 다시 로드
      if (selectedSourceWorkspace) {
        setTimeout(() => {
          fetchProjects(selectedSourceWorkspace).catch(console.error);
        }, 1000);
      }
    } catch (error: any) {
      console.error("프로젝트 이동 실패:", error);

      // 상세 오류 정보 로깅
      if (error instanceof Error) {
        console.error("오류 이름:", error.name);
        console.error("오류 메시지:", error.message);
        console.error("오류 스택:", error.stack);
      }

      const errorResponse = (error)?.response;
      if (errorResponse) {
        console.error("서버 응답 상태:", errorResponse.status);
        console.error("서버 응답 데이터:", errorResponse.data);
      }

      // 사용자에게 오류 메시지 표시
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message:
          "프로젝트 이동 중 오류가 발생했습니다: " +
          (error?.response?.data?.error || error?.message || "알 수 없는 오류"),
      });

      // 401 에러 처리
      if (error?.response?.status === 401) {
        handleAuthError();
      }
    } finally {
      setIsTransferring(false);
    }
  };

  // 로딩 중일 때 표시
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="w-10 h-10">로딩 중...</Loader>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <div className="mb-8">
        <h2 className="text-xl font-medium text-custom-text-100">프로젝트 이동</h2>
        <p className="text-sm text-custom-text-300">
          프로젝트를 다른 워크스페이스로 이동합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* 소스 워크스페이스 선택 */}
        <div>
          <label className="block text-sm font-medium text-custom-text-100 mb-2">소스 워크스페이스</label>
          <CustomSelect
            key={selectedSourceWorkspace || "workspace-select"}
            value={selectedSourceWorkspace}
            label={workspaces.find((w) => w.id === selectedSourceWorkspace)?.name || "워크스페이스 선택"}
            onChange={(value: string | null) => {
              // console.log("워크스페이스 선택됨:", value);
              if (value) {
                setSelectedSourceWorkspace(value);
                setSelectedProject(null);
                fetchProjects(value);
              } else {
                setSelectedProject(null);
                setProjects([]);
              }
            }}
            disabled={isLoading || isTransferring}
          >
            {workspaces.map((workspace) => (
              <CustomSelect.Option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        {/* 프로젝트 선택 */}
        <div>
          <label className="block text-sm font-medium text-custom-text-100 mb-2">프로젝트</label>
          <CustomSelect
            key={`project-select-${selectedSourceWorkspace || ""}`}
            value={selectedProject}
            label={projects.find((p) => p.id === selectedProject)?.name || "프로젝트 선택"}
            onChange={handleProjectChange}
            disabled={!selectedSourceWorkspace || isLoading || isTransferring}
          >
            {projects.map((project) => (
              <CustomSelect.Option key={project.id} value={project.id}>
                {project.name}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        {/* 대상 워크스페이스 선택 */}
        <div>
          <label className="block text-sm font-medium text-custom-text-100 mb-2">대상 워크스페이스</label>
          <CustomSelect
            key={`target-workspace-select-${selectedProject || ""}`}
            value={selectedTargetWorkspace}
            label={workspaces.find((w) => w.id === selectedTargetWorkspace)?.name || "워크스페이스 선택"}
            onChange={handleTargetWorkspaceChange}
            disabled={!selectedProject || isLoading || isTransferring}
          >
            {workspaces
              .filter((workspace) => workspace.id !== selectedSourceWorkspace)
              .map((workspace) => (
                <CustomSelect.Option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </CustomSelect.Option>
              ))}
          </CustomSelect>
        </div>

        {/* 이동 버튼 */}
        <div className="pt-4">
          <Button
            variant="primary"
            onClick={handleProjectTransfer}
            disabled={!selectedSourceWorkspace || !selectedProject || !selectedTargetWorkspace || isTransferring}
            loading={isTransferring}
          >
            {isTransferring ? "이동 중..." : "프로젝트 이동"}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default ProjectManagementPage;
