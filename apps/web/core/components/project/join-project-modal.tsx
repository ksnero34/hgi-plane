import { useState, Fragment } from "react";

import { Transition, Dialog } from "@headlessui/react";
// types
import { Button } from "@plane/propel/button";
import type { IProject } from "@plane/types";
// ui
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

// type
type TJoinProjectModalProps = {
  isOpen: boolean;
  workspaceSlug: string;
  project: IProject;
  handleClose: () => void;
};

export function JoinProjectModal(props: TJoinProjectModalProps) {
  const { handleClose, isOpen, project, workspaceSlug } = props;
  // states
  const [isJoiningLoading, setIsJoiningLoading] = useState(false);
  // store hooks
  const { joinProject } = useUserPermissions();
  const { fetchProjectDetails } = useProject();
  // router
  const router = useAppRouter();

  const handleJoin = () => {
    setIsJoiningLoading(true);

    joinProject(workspaceSlug, project.id)
      .then(() => {
        router.push(`/${workspaceSlug}/projects/${project.id}/issues`);
        fetchProjectDetails(workspaceSlug, project.id);
        handleClose();
      })
      .finally(() => {
        setIsJoiningLoading(false);
      });
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-20" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-custom-backdrop transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-20 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-custom-background-100 px-5 py-8 text-left shadow-custom-shadow-md transition-all sm:w-full sm:max-w-xl sm:p-6">
                <div className="space-y-5">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-custom-text-100">
                    프로젝트에 참가하시겠습니까?
                  </Dialog.Title>
                  <p>
                    <span className="break-words font-semibold">{project?.name}</span> 프로젝트에 참여하시겠습니까?
                    아래의 &apos;참여하기&apos; 버튼을 클릭하여 계속 진행하세요.
                  </p>
                  <div className="space-y-3" />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="neutral-primary" size="sm" onClick={handleClose}>
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    tabIndex={1}
                    type="submit"
                    onClick={handleJoin}
                    loading={isJoiningLoading}
                  >
                    {isJoiningLoading ? "참여중..." : "참여하기"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
