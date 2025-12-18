// store
import { useState } from "react";
import { FileOutput } from "lucide-react";
import { Tooltip } from "@plane/propel/tooltip";
import { MovePageModal } from "@/plane-web/components/pages";
import type { TPageInstance } from "@/store/pages/base-page";

export type TPageMoveControlProps = {
  page: TPageInstance;
};

export const PageMoveControl = ({ page }: TPageMoveControlProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!page) return null;

  return (
    <>
      <MovePageModal isOpen={isOpen} onClose={() => setIsOpen(false)} page={page} />
      <Tooltip tooltipContent="Move" position="bottom">
        <button
          type="button"
          className="flex-shrink-0 size-6 grid place-items-center rounded text-custom-text-200 hover:text-custom-text-100 hover:bg-custom-background-80"
          onClick={() => setIsOpen(true)}
          aria-label="Move"
        >
          <FileOutput className="size-3.5" />
        </button>
      </Tooltip>
    </>
  );
};
