import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { usePopper } from "react-popper";
import { ChevronDown, Search } from "lucide-react";
import { Combobox } from "@headlessui/react";
// plane imports
import { useTranslation } from "@plane/i18n";
// ui
import { ComboDropDown, Loader } from "@plane/ui";
// helpers
import { cn, getEmojiImageUrlFromDecimal } from "@plane/utils";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
import { useDropdown } from "@/hooks/use-dropdown";
// types
import type { IProjectIssueType } from "@plane/types";
// components
import { DropdownButton } from "@/components/dropdowns/buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "@/components/dropdowns/constants";
import type { TDropdownProps } from "@/components/dropdowns/types";

export type TIssueTypeDropdownProps = TDropdownProps & {
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  iconSize?: string;
  onChange: (val: string) => void;
  onClose?: () => void;
  projectId: string | undefined;
  value: string | undefined | null;
  renderByDefault?: boolean;
};

export const IssueTypeDropdown: React.FC<TIssueTypeDropdownProps> = observer((props) => {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    hideIcon = false,
    iconSize = "size-4",
    onChange,
    onClose,
    placeholder = "Issue type",
    placement,
    projectId,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
  } = props;
  // router
  const { workspaceSlug } = useParams();
  // refs
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // popper-js refs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // store hooks
  const { t } = useTranslation();
  const { issueTypes, isLoading, getDefaultIssueType } = useIssueType(projectId || "");
  // popper-js init
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: placement ?? "bottom-start",
    modifiers: [
      {
        name: "preventOverflow",
        options: {
          padding: 12,
        },
      },
    ],
  });
  // dropdown init
  const { handleClose, handleKeyDown, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose,
    query,
    setIsOpen,
    setQuery,
  });

  const renderEmojiFromCode = useCallback((code: string) => {
    if (!code) return null;

    const imageUrl = getEmojiImageUrlFromDecimal(code);
    if (imageUrl) {
      return <img src={imageUrl} alt="" className="h-4 w-4" loading="lazy" />;
    }

    const codePoints = code
      .split("-")
      .map((segment) => parseInt(segment, 10))
      .filter((segment) => !Number.isNaN(segment));

    if (!codePoints.length) return null;

    try {
      return <>{String.fromCodePoint(...codePoints)}</>;
    } catch (e) {
      return null;
    }
  }, []);

  const options = useMemo(() => {
    if (!issueTypes || issueTypes.length === 0) return [];

    return issueTypes.map((projectIssueType: IProjectIssueType) => {
      // 중첩된 데이터 구조 처리: projectIssueType.issue_type이 실제 이슈 타입
      const issueType = projectIssueType.issue_type || projectIssueType;

      const emojiNode = renderEmojiFromCode(issueType.logo_props?.emoji?.value ?? "");
      const iconName = issueType.logo_props?.icon?.name || issueType.icon;

      return {
        value: projectIssueType.id, // ProjectIssueType의 ID를 사용
        query: issueType.name || "",
        content: (
          <div className="flex items-center gap-2">
            {emojiNode ? (
              <span className="inline-flex h-4 w-4 items-center justify-center">{emojiNode}</span>
            ) : iconName ? (
              <span style={{ color: issueType.color }} className="material-symbols-rounded">
                {iconName}
              </span>
            ) : null}
            <span className="flex-grow truncate">{issueType.name || "Unnamed"}</span>
          </div>
        ),
      };
    });
  }, [issueTypes, renderEmojiFromCode]);

  const filteredOptions = useMemo(() => {
    if (!options) return [];
    return query === ""
      ? options
      : options.filter((option) => {
          if (!option?.query) return false;
          return option.query.toLowerCase().includes(query.toLowerCase());
        });
  }, [options, query]);

  const selectedOption = useMemo(() => {
    if (!issueTypes || issueTypes.length === 0) return undefined;

    // 선택된 값이 있으면 해당 이슈 타입 반환
    if (value) {
      const found = issueTypes.find((projectIssueType: IProjectIssueType) => {
        return projectIssueType.id === value; // ProjectIssueType의 ID로 비교
      });
      return found || undefined;
    }

    // 선택된 값이 없으면 기본 이슈 타입 반환
    return getDefaultIssueType();
  }, [issueTypes, value, getDefaultIssueType]);

  const getIssueTypeIcon = (projectIssueType: IProjectIssueType | undefined) => {
    if (!projectIssueType) return null;

    // 중첩된 데이터 구조 처리
    const issueType = projectIssueType.issue_type || projectIssueType;

    if (issueType.logo_props?.emoji?.value) {
      const emojiNode = renderEmojiFromCode(issueType.logo_props.emoji.value);
      if (emojiNode) {
        return <span className="inline-flex h-4 w-4 items-center justify-center">{emojiNode}</span>;
      }
    }

    const iconName = issueType.logo_props?.icon?.name || issueType.icon;

    return iconName ? (
      <span style={{ color: issueType.color }} className="material-symbols-rounded">
        {iconName}
      </span>
    ) : null;
  };

  const dropdownOnChange = (val: string) => {
    onChange(val);
    handleClose();
  };

  const comboButton = (
    <>
      {button ? (
        <button
          ref={setReferenceElement}
          type="button"
          className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
          onClick={handleOnClick}
          disabled={disabled}
        >
          {button}
        </button>
      ) : (
        <button
          ref={setReferenceElement}
          type="button"
          className={cn(
            "clickable block h-full max-w-full outline-none",
            {
              "cursor-not-allowed text-custom-text-200": disabled,
              "cursor-pointer": !disabled,
            },
            buttonContainerClassName
          )}
          onClick={handleOnClick}
          disabled={disabled}
        >
          <DropdownButton
            className={buttonClassName}
            isActive={isOpen}
            tooltipHeading={t("issue_type")}
            tooltipContent={selectedOption?.issue_type?.name || placeholder}
            showTooltip={showTooltip}
            variant={buttonVariant}
            renderToolTipByDefault={renderByDefault}
          >
            {!hideIcon && getIssueTypeIcon(selectedOption)}
            {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
              <span className="truncate max-w-40">{selectedOption?.issue_type?.name || placeholder}</span>
            )}
            {dropdownArrow && (
              <ChevronDown className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
            )}
          </DropdownButton>
        </button>
      )}
    </>
  );

  if (isLoading) return <Loader className="h-3 w-3">Loading...</Loader>;

  return (
    <ComboDropDown
      as="div"
      ref={dropdownRef}
      tabIndex={tabIndex}
      className={cn("h-full", className)}
      value={value}
      onChange={dropdownOnChange}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      button={comboButton}
      renderByDefault={renderByDefault}
    >
      {isOpen && (
        <Combobox.Options className="fixed z-10" static>
          <div
            className="my-1 w-48 rounded border-[0.5px] border-custom-border-300 bg-custom-background-100 px-2 py-2.5 text-xs shadow-custom-shadow-rg focus:outline-none"
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <div className="flex items-center gap-1.5 rounded border border-custom-border-100 bg-custom-background-90 px-2">
              <Search className="h-3.5 w-3.5 text-custom-text-400" strokeWidth={1.5} />
              <Combobox.Input
                as="input"
                ref={inputRef}
                className="w-full bg-transparent py-1 text-xs text-custom-text-200 placeholder:text-custom-text-400 focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                onKeyDown={searchInputKeyDown}
              />
            </div>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
              {filteredOptions ? (
                filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <Combobox.Option
                      key={option.value}
                      value={option.value}
                      className={({ active, selected }) =>
                        `w-full truncate flex items-center justify-between gap-2 rounded px-1 py-1.5 cursor-pointer select-none ${
                          active ? "bg-custom-background-80" : ""
                        } ${selected ? "text-custom-text-100" : "text-custom-text-200"}`
                      }
                    >
                      <span className="flex-grow truncate">{option.content}</span>
                    </Combobox.Option>
                  ))
                ) : (
                  <p className="text-custom-text-400 italic py-1 px-1.5">{t("no_matching_results")}</p>
                )
              ) : (
                <p className="text-custom-text-400 italic py-1 px-1.5">{t("loading")}</p>
              )}
            </div>
          </div>
        </Combobox.Options>
      )}
    </ComboDropDown>
  );
});
