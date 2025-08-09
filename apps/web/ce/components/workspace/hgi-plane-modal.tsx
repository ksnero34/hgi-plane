import { FC, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
// ui
import { Button } from "@plane/ui";

interface IHGIPlanModalProps {
  isOpen: boolean;
  handleClose: () => void;
}

export const HGIPlanModal: FC<IHGIPlanModalProps> = ({ isOpen, handleClose }) => {
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-custom-background-100 text-left shadow-custom-shadow-md transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title as="h3" className="text-lg font-semibold text-custom-text-100">
                      Plane
                    </Dialog.Title>
                    <button
                      type="button"
                      className="rounded p-1 text-custom-text-400 hover:bg-custom-background-90"
                      onClick={handleClose}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-base text-custom-text-200">
                      한화손해보험 이슈 트래커
                    </p>
                    
                    <div className="mt-6">
                      <p className="text-sm text-custom-text-300 mb-2">문의</p>
                      <a
                        href="mailto:minpaper@hanwha.com"
                        className="text-custom-primary-100 hover:text-custom-primary-200 underline text-sm"
                      >
                        minpaper@hanwha.com
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-3 bg-custom-background-90">
                  <div className="flex items-center justify-end">
                    <Button variant="neutral-primary" size="sm" onClick={handleClose}>
                      닫기
                    </Button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};