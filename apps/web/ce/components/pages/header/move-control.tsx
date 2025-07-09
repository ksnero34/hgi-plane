"use client";

// store
import { useState } from "react";
import { FileOutput } from "lucide-react";
import { Tooltip } from "@plane/ui";
import { MovePageModal } from "@/plane-web/components/pages";
import { TPageInstance } from "@/store/pages/base-page";

export type TPageMoveControlProps = {
  page: TPageInstance;
};

export const PageMoveControl: React.FC<TPageMoveControlProps> = ({ page }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!page) return null;

  return (
    <>
      <MovePageModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        page={page}
      />
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
