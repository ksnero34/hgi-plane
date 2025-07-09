"use client";

import React from "react";
// ui
import { Copy } from "lucide-react";
import { Button, TOAST_TYPE, setToast } from "@plane/ui";
// icons

type Props = {
  label: string;
  url: string;
  description: string | JSX.Element;
};

export type TCopyField = {
  key: string;
  label: string;
  url: string;
  description: string | JSX.Element;
};

export const CopyField: React.FC<Props> = (props) => {
  const { label, url, description } = props;

  const handleCopy = async () => {
    try {
      // Modern API 시도
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } 
      // Fallback: 구형 브라우저를 위한 방식
      else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setToast({
        type: TOAST_TYPE.INFO,
        title: "Copied to clipboard",
        message: `The ${label} has been successfully copied to your clipboard`,
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Failed to copy",
        message: "Unable to copy to clipboard. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm text-custom-text-200">{label}</h4>
      <Button
        variant="neutral-primary"
        className="flex items-center justify-between py-2"
        onClick={handleCopy}
      >
        <p className="text-sm font-medium">{url}</p>
        <Copy size={18} color="#B9B9B9" />
      </Button>
      <div className="text-xs text-custom-text-300">{description}</div>
    </div>
  );
};
