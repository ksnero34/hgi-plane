"use client";

// icons
import { FileText, Layers } from "lucide-react";
import { ContrastIcon, DiceIcon, LayersIcon } from "@plane/propel/icons";
// types
import { TTourSteps } from "./root";

const sidebarOptions: {
  key: TTourSteps;
  label: string;
  Icon: any;
}[] = [
  {
    key: "work-items",
    label: "작업항목",
    Icon: LayersIcon,
  },
  {
    key: "cycles",
    label: "주기",
    Icon: ContrastIcon,
  },
  {
    key: "modules",
    label: "모듈",
    Icon: DiceIcon,
  },
  {
    key: "views",
    label: "보기",
    Icon: Layers,
  },
  {
    key: "pages",
    label: "페이지",
    Icon: FileText,
  },
];

type Props = {
  step: TTourSteps;
  setStep: React.Dispatch<React.SetStateAction<TTourSteps>>;
};

export const TourSidebar: React.FC<Props> = ({ step, setStep }) => (
  <div className="col-span-3 hidden bg-custom-background-90 p-8 lg:block">
    <h3 className="text-lg font-medium">
      Plane에 대해 알아봅시다.
      <br />
      <br />
      이슈트래커(Plane)를 활용해서 팀과 협업하고 이슈를 정리하여 업무 효율을 높여보세요.
    </h3>
    <div className="mt-8 space-y-5">
      {sidebarOptions.map((option) => (
        <h5
          key={option.key}
          className={`flex cursor-pointer items-center gap-2 border-l-[3px] py-0.5 pl-3 pr-2 text-sm font-medium capitalize ${
            step === option.key
              ? "border-custom-primary-100 text-custom-primary-100"
              : "border-transparent text-custom-text-200"
          }`}
          onClick={() => setStep(option.key)}
          role="button"
        >
          <option.Icon className="h-4 w-4" aria-hidden="true" />
          {option.label}
        </h5>
      ))}
    </div>
  </div>
);
