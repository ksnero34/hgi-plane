"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronDown, Upload } from "lucide-react";
// editor
import { EditorRefApi } from "@plane/editor";
import { useFileAttachmentUploader } from "@plane/editor/src/core/hooks/use-file-attachment-upload";
// ui
import { CustomMenu, Tooltip, Loader, setToast, TOAST_TYPE } from "@plane/ui";
// components
import { ColorDropdown } from "@/components/pages";
// constants
import { TOOLBAR_ITEMS, TYPOGRAPHY_ITEMS, ToolbarMenuItem } from "@/constants/editor";
// helpers
import { cn } from "@/helpers/common.helper";
// services
import { FileService } from "@/services/file.service";
// types
import { EFileAssetType } from "@plane/types/src/enums";
import { IPage } from "@/store/pages/page";
import { useFileValidation } from "@/hooks/store/use-file-validation";
import { insertFileAttachment } from "@plane/editor/src/core/helpers/editor-commands";

const fileService = new FileService();

type Props = {
  editorRef: EditorRefApi;
  page: IPage;
};

type ToolbarButtonProps = {
  item: ToolbarMenuItem;
  isActive: boolean;
  executeCommand: EditorRefApi["executeMenuItemCommand"];
};

const ToolbarButton: React.FC<ToolbarButtonProps> = React.memo((props) => {
  const { item, isActive, executeCommand } = props;

  return (
    <Tooltip
      tooltipContent={
        <p className="flex flex-col gap-1 text-center text-xs">
          <span className="font-medium">{item.name}</span>
          {item.shortcut && <kbd className="text-custom-text-400">{item.shortcut.join(" + ")}</kbd>}
        </p>
      }
    >
      <button
        type="button"
        onClick={() =>
          // TODO: update this while toolbar homogenization
          // @ts-expect-error type mismatch here
          executeCommand({
            itemKey: item.itemKey,
            ...item.extraProps,
          })
        }
        className={cn("grid size-7 place-items-center rounded text-custom-text-300 hover:bg-custom-background-80", {
          "bg-custom-background-80 text-custom-text-100": isActive,
        })}
      >
        <item.icon
          className={cn("size-4", {
            "text-custom-text-100": isActive,
          })}
        />
      </button>
    </Tooltip>
  );
});

ToolbarButton.displayName = "ToolbarButton";

const toolbarItems = TOOLBAR_ITEMS.document;

const FileUploadButton = ({ editorRef }: { editorRef: EditorRefApi }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      insertFileAttachment({
        editor: editorRef,
        event: "insert",
        file
      });
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 업로드 실패",
        message: "파일 업로드 중 오류가 발생했습니다."
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [editorRef]);

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="*.*"
      />
      <Tooltip
        tooltipContent={
          <p className="flex flex-col gap-1 text-center text-xs">
            <span className="font-medium">파일 업로드</span>
          </p>
        }
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-custom-text-300 text-sm border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 h-7 rounded px-2 flex items-center gap-2"
        >
          <Upload className="size-3" />
          <span>파일</span>
        </button>
      </Tooltip>
    </>
  );
};

export const PageToolbar: React.FC<Props> = ({ editorRef, page }) => {
  // states
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  const updateActiveStates = useCallback(() => {
    if (!editorRef) return;
    
    const newActiveStates: Record<string, boolean> = {};
    Object.values(toolbarItems)
      .flat()
      .forEach((item) => {
        newActiveStates[item.renderKey] = editorRef.isMenuItemActive({
          itemKey: item.itemKey,
          ...item.extraProps,
        });
      });
    setActiveStates(newActiveStates);
  }, [editorRef]);

  useEffect(() => {
    if (!editorRef) return;
    
    const unsubscribe = editorRef.onStateChange(updateActiveStates);
    updateActiveStates();
    return () => unsubscribe();
  }, [editorRef, updateActiveStates]);

  const activeTypography = TYPOGRAPHY_ITEMS.find((item) =>
    editorRef?.isMenuItemActive({
      itemKey: item.itemKey,
      ...item.extraProps,
    })
  );

  // page가 없거나 id가 없으면 로딩 상태 표시
  if (!page || !page.id) {
    return (
      <div className="flex flex-wrap items-center divide-x divide-custom-border-200">
        <div className="w-full h-[44px] flex items-center justify-center">
          <Loader className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center divide-x divide-custom-border-200">
      <CustomMenu
        customButton={
          <span className="text-custom-text-300 text-sm border-[0.5px] border-custom-border-300 hover:bg-custom-background-80 h-7 w-24 rounded px-2 flex items-center justify-between gap-2 whitespace-nowrap text-left">
            {activeTypography?.name || "Text"}
            <ChevronDown className="flex-shrink-0 size-3" />
          </span>
        }
        className="pr-2"
        placement="bottom-start"
        closeOnSelect
        maxHeight="lg"
      >
        {TYPOGRAPHY_ITEMS.map((item) => (
          <CustomMenu.MenuItem
            key={item.renderKey}
            className="flex items-center justify-between gap-2"
            onClick={() =>
              editorRef?.executeMenuItemCommand({
                itemKey: item.itemKey,
                ...item.extraProps,
              })
            }
          >
            <span className="flex items-center gap-2">
              <item.icon className="size-3" />
              {item.name}
            </span>
            {activeTypography?.itemKey === item.itemKey && (
              <Check className="size-3 text-custom-text-300 flex-shrink-0" />
            )}
          </CustomMenu.MenuItem>
        ))}
      </CustomMenu>
      <ColorDropdown
        handleColorSelect={(key, color) =>
          editorRef?.executeMenuItemCommand({
            itemKey: key,
            color,
          })
        }
        isColorActive={(key, color) =>
          editorRef?.isMenuItemActive({
            itemKey: key,
            color,
          })
        }
      />
      {Object.keys(toolbarItems).map((key) => (
        <div key={key} className="flex items-center gap-0.5 px-2 first:pl-0 last:pr-0">
          {toolbarItems[key].map((item) => (
            <ToolbarButton
              key={item.renderKey}
              item={item}
              isActive={activeStates[item.renderKey]}
              executeCommand={editorRef?.executeMenuItemCommand}
            />
          ))}
        </div>
      ))}
      <FileUploadButton editorRef={editorRef} />
    </div>
  );
};
