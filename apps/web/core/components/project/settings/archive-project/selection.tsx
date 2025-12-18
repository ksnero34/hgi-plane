import React from "react";
import { Disclosure, Transition } from "@headlessui/react";
// types
import { Button } from "@plane/propel/button";
import { ChevronRightIcon, ChevronUpIcon } from "@plane/propel/icons";
import type { IProject } from "@plane/types";
// ui
import { Loader } from "@plane/ui";

export interface IArchiveProject {
  projectDetails: IProject;
  handleArchive: () => void;
}

export function ArchiveProjectSelection(props: IArchiveProject) {
  const { projectDetails, handleArchive } = props;

  return (
    <Disclosure as="div" className="border-t border-custom-border-100 py-4">
      {({ open }) => (
        <div className="w-full">
          <Disclosure.Button as="button" type="button" className="flex w-full items-center justify-between">
            <span className="text-xl tracking-tight">프로젝트 보관</span>
            {open ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </Disclosure.Button>
          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform opacity-0"
            enterTo="transform opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform opacity-100"
            leaveTo="transform opacity-0"
          >
            <Disclosure.Panel>
              <div className="flex flex-col gap-8 pt-4">
                <span className="text-sm tracking-tight">
                  프로젝트를 보관하면 사이드 네비게이션에서 프로젝트가 더 이상 표시되지 않지만 프로젝트 페이지에서 계속
                  액세스할 수 있습니다. 프로젝트를 복원하거나 삭제할 수 있습니다.
                </span>
                <div>
                  {projectDetails ? (
                    <div>
                      <Button variant="outline-danger" onClick={handleArchive}>
                        보관하기
                      </Button>
                    </div>
                  ) : (
                    <Loader className="mt-2 w-full">
                      <Loader.Item height="38px" width="144px" />
                    </Loader>
                  )}
                </div>
              </div>
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
}
