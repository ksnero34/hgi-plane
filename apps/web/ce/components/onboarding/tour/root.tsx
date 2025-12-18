import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { PRODUCT_TOUR_TRACKER_ELEMENTS } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { CloseIcon, PlaneLockup } from "@plane/propel/icons";
// assets
import CyclesTour from "@/app/assets/onboarding/cycles.webp?url";
import IssuesTour from "@/app/assets/onboarding/issues.webp?url";
import ModulesTour from "@/app/assets/onboarding/modules.webp?url";
import PagesTour from "@/app/assets/onboarding/pages.webp?url";
import ViewsTour from "@/app/assets/onboarding/views.webp?url";
// helpers
import { captureClick } from "@/helpers/event-tracker.helper";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUser } from "@/hooks/store/user";
// local imports
import { TourSidebar } from "./sidebar";

export type TOnboardingTourProps = {
  onComplete: () => void;
};

export type TTourSteps = "welcome" | "work-items" | "cycles" | "modules" | "views" | "pages";

const TOUR_STEPS: {
  key: TTourSteps;
  title: string;
  description: string;
  image: string;
  prevStep?: TTourSteps;
  nextStep?: TTourSteps;
}[] = [
  {
    key: "work-items",
    title: "작업항목으로 계획 세우기",
    description:
      "작업항목은 이슈트래커(Plane)의 기본 구성 요소입니다. 이슈 라고도 불리며 이슈 트래커의 대부분의 기능은 작업항목과 그 속성에 연관되어 있습니다.",
    image: IssuesTour,
    nextStep: "cycles",
  },
  {
    key: "cycles",
    title: "주기로 진행 관리하기",
    description: "주기는 애자일 개발에서 흔히 사용되는 스프린트처럼, 팀이 더 빠르게 나아갈 수 있도록 도와줍니다.",
    image: CyclesTour,
    prevStep: "work-items",
    nextStep: "modules",
  },
  {
    key: "modules",
    title: "모듈로 나누기",
    description: "모듈은 큰 작업을 프로젝트나 기능 단위로 나누어 더 체계적으로 정리할 수 있도록 도와줍니다.",
    image: ModulesTour,
    prevStep: "cycles",
    nextStep: "views",
  },
  {
    key: "views",
    title: "보기로 원하는 뷰 만들기",
    description:
      "보기를 사용해 필요한 작업항목만 보기 쉽게 설정하고, 클릭 몇 번으로 저장 및 공유할 수 있습니다. 특히 작업항목이 늘어나면 보기를 통해 효율적으로 관리할 수 있습니다.",
    image: ViewsTour,
    prevStep: "modules",
    nextStep: "pages",
  },
  {
    key: "pages",
    title: "페이지로 문서화하기",
    description:
      "회의 중이거나 하루를 시작할 때, 페이지를 활용해 빠르게 내용을 작성할 수 있습니다. 또한 팀원과 동일한 페이지를 실시간으로 수정할 수 있습니다.",
    image: PagesTour,
    prevStep: "views",
  },
];

export const TourRoot = observer(function TourRoot(props: TOnboardingTourProps) {
  const { onComplete } = props;
  // states
  const [step, setStep] = useState<TTourSteps>("welcome");
  // store hooks
  const { toggleCreateProjectModal } = useCommandPalette();
  const { data: currentUser } = useUser();

  const currentStepIndex = TOUR_STEPS.findIndex((tourStep) => tourStep.key === step);
  const currentStep = TOUR_STEPS[currentStepIndex];

  return (
    <>
      {step === "welcome" ? (
        <div className="w-4/5 overflow-hidden rounded-[10px] bg-custom-background-100 md:w-1/2 lg:w-2/5">
          <div className="h-full overflow-hidden">
            <div className="grid h-64 place-items-center bg-custom-primary-100">
              <PlaneLockup className="h-10 w-auto text-white" />
            </div>
            <div className="flex flex-col overflow-y-auto p-6">
              <h3 className="font-semibold sm:text-xl">
                이슈트래커(Plane)에 오신 것을 환영합니다, {currentUser?.last_name} {currentUser?.first_name} 님
              </h3>
              <p className="mt-3 text-sm text-custom-text-200">
                Plane을 사용하여 프로젝트를 관리할 수 있습니다. 프로젝트를 생성하여 시작하세요.
                <br />
                기존에 생성된 프로젝트에 참가하시려면 왼쪽 사이드바에서 프로젝트를 누른뒤 원하는 프로젝트에 참가하거나
                팀원에게 프로젝트 초대를 요청하세요.
              </p>
              <div className="flex h-full items-end">
                <div className="mt-12 flex items-center gap-6">
                  <Button
                    variant="primary"
                    onClick={() => {
                      captureClick({
                        elementName: PRODUCT_TOUR_TRACKER_ELEMENTS.START_BUTTON,
                      });
                      setStep("work-items");
                    }}
                  >
                    튜토리얼 보기
                  </Button>
                  <button
                    type="button"
                    className="bg-transparent text-xs font-medium text-custom-primary-100 outline-custom-text-100"
                    onClick={() => {
                      captureClick({
                        elementName: PRODUCT_TOUR_TRACKER_ELEMENTS.SKIP_BUTTON,
                      });
                      onComplete();
                    }}
                  >
                    넘어가기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative grid h-3/5 w-4/5 grid-cols-10 overflow-hidden rounded-[10px] bg-custom-background-100 sm:h-3/4 md:w-1/2 lg:w-3/5">
          <button
            type="button"
            className="fixed right-[9%] top-[19%] z-10 -translate-y-1/2 translate-x-1/2 cursor-pointer rounded-full border border-custom-text-100 p-1 sm:top-[11.5%] md:right-[24%] lg:right-[19%]"
            onClick={onComplete}
          >
            <CloseIcon className="h-3 w-3 text-custom-text-100" />
          </button>
          <TourSidebar step={step} setStep={setStep} />
          <div className="col-span-10 h-full overflow-hidden lg:col-span-7">
            <div
              className={`flex h-1/2 items-end overflow-hidden bg-custom-primary-100 sm:h-3/5 ${
                currentStepIndex % 2 === 0 ? "justify-end" : "justify-start"
              }`}
            >
              <img src={currentStep?.image} className="w-full h-full object-cover" alt={currentStep?.title} />
            </div>
            <div className="flex h-1/2 flex-col overflow-y-auto p-4 sm:h-2/5">
              <h3 className="font-semibold sm:text-xl">{currentStep?.title}</h3>
              <p className="mt-3 text-sm text-custom-text-200">{currentStep?.description}</p>
              <div className="mt-3 flex h-full items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  {currentStep?.prevStep && (
                    <Button variant="neutral-primary" onClick={() => setStep(currentStep.prevStep ?? "welcome")}>
                      이전
                    </Button>
                  )}
                  {currentStep?.nextStep && (
                    <Button variant="primary" onClick={() => setStep(currentStep.nextStep ?? "work-items")}>
                      다음
                    </Button>
                  )}
                </div>
                {currentStepIndex === TOUR_STEPS.length - 1 && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      captureClick({
                        elementName: PRODUCT_TOUR_TRACKER_ELEMENTS.CREATE_PROJECT_BUTTON,
                      });
                      onComplete();
                      toggleCreateProjectModal(true);
                    }}
                  >
                    첫 프로젝트 생성하기
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
