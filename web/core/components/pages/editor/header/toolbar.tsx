"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Check, ChevronDown } from "lucide-react";
// editor
import { EditorRefApi } from "@plane/editor";
// ui
import { CustomMenu, Tooltip, setToast, TOAST_TYPE } from "@plane/ui";
// components
import { ColorDropdown } from "@/components/pages";
// constants
import { TOOLBAR_ITEMS, TYPOGRAPHY_ITEMS, ToolbarMenuItem } from "@/constants/editor";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  editorRef: EditorRefApi;
};

type ToolbarButtonProps = {
  item: ToolbarMenuItem;
  isActive: boolean;
  executeCommand: EditorRefApi["executeMenuItemCommand"];
  editorRef: EditorRefApi;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = React.memo((props) => {
  const { item, isActive, executeCommand, editorRef } = props;
  // store hooks
  const { fileSettings } = useInstance();

  const validateFile = (file: File): boolean => {
    // 파일 확장자 체크
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !fileSettings?.allowed_extensions?.includes(fileExtension)) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 형식 오류",
        message: `허용되는 파일 형식: ${fileSettings?.allowed_extensions?.join(', ')}`,
      });
      return false;
    }

    // 파일 크기 체크 (bytes로 변환)
    const maxSize = fileSettings?.max_file_size || 5 * 1024 * 1024; // 기본값 5MB
    if (file.size > maxSize) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "파일 크기 초과",
        message: `최대 파일 크기: ${Math.floor(maxSize / (1024 * 1024))}MB`,
      });
      return false;
    }

    return true;
  };

  const handleClick = () => {
    // TODO: update this while toolbar homogenization
    // @ts-expect-error type mismatch here
    executeCommand({
      itemKey: item.itemKey,
      ...item.extraProps,
    });
  };

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
        onClick={handleClick}
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

export const PageToolbar: React.FC<Props> = ({ editorRef }) => {
  // states
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  const updateActiveStates = useCallback(() => {
    const newActiveStates: Record<string, boolean> = {};
    Object.values(toolbarItems)
      .flat()
      .forEach((item) => {
        // TODO: update this while toolbar homogenization
        // @ts-expect-error type mismatch here
        newActiveStates[item.renderKey] = editorRef.isMenuItemActive({
          itemKey: item.itemKey,
          ...item.extraProps,
        });
      });
    setActiveStates(newActiveStates);
  }, [editorRef]);

  useEffect(() => {
    const unsubscribe = editorRef.onStateChange(updateActiveStates);
    updateActiveStates();
    return () => unsubscribe();
  }, [editorRef, updateActiveStates]);

  const activeTypography = TYPOGRAPHY_ITEMS.find((item) =>
    editorRef.isMenuItemActive({
      itemKey: item.itemKey,
      ...item.extraProps,
    })
  );

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
              editorRef.executeMenuItemCommand({
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
          editorRef.executeMenuItemCommand({
            itemKey: key,
            color,
          })
        }
        isColorActive={(key, color) =>
          editorRef.isMenuItemActive({
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
              executeCommand={editorRef.executeMenuItemCommand}
              editorRef={editorRef}
            />
          ))}
        </div>
      ))}
    </div>
  );
};