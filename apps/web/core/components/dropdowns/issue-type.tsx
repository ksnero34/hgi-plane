"use client";

import { ReactNode, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@plane/i18n";
// ui
import { ComboDropDown, Loader } from "@plane/ui";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
import { useDropdown } from "@/hooks/use-dropdown";
// components
import { DropdownButton } from "./buttons";
// constants
import { BUTTON_VARIANTS_WITH_TEXT } from "./constants";
// types
import { TDropdownProps } from "./types";

type Props = TDropdownProps & {
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  onChange: (val: string) => void;
  onClose?: () => void;
  projectId: string | undefined;
  value: string | undefined | null;
};

export const IssueTypeDropdown: React.FC<Props> = observer((props) => {
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
    onChange,
    onClose,
    placeholder = "Issue type",
    placement,
    projectId,
    showTooltip = false,
    tabIndex,
    value,
  } = props;
  // router
  const { workspaceSlug } = useParams();
  // hooks
  const { t } = useTranslation();
  const { issueTypes, isLoading } = useIssueType(projectId || "");

  const {
    handleClose,
    handleKeyDown,
    handleOnClick,
    searchInputKeyDown,
    isOpen,
    searchQuery,
    setIsOpen,
    setSearchQuery,
  } = useDropdown({
    dropdownRef: null,
    isDisabled: disabled,
    onClose,
  });

  const dropdownOptions = useMemo(() => {
    if (!issueTypes) return [];

    return issueTypes.map((issueType) => ({
      value: issueType.id,
      query: issueType.name,
      content: (
        <div className="flex items-center gap-2">
          {issueType.icon && (
            <span style={{ color: issueType.color }}>{issueType.icon}</span>
          )}
          <span className="flex-grow truncate">{issueType.name}</span>
        </div>
      ),
    }));
  }, [issueTypes]);

  const selectedOption = issueTypes?.find((issueType) => issueType.id === value);

  const ButtonToRender = useMemo(() => {
    if (button) return button;

    return (
      <DropdownButton
        className={cn(
          "clickable block w-full max-w-full text-left",
          {
            "text-custom-text-400": !selectedOption,
          },
          buttonClassName
        )}
        isActive={isOpen}
        tooltipHeading={t("issue_type")}
        tooltipContent={selectedOption?.name ?? placeholder}
        showTooltip={showTooltip}
        variant={buttonVariant}
      >
        {!hideIcon && selectedOption?.icon && (
          <span style={{ color: selectedOption.color }}>{selectedOption.icon}</span>
        )}
        <span className="flex-grow truncate">
          {selectedOption?.name ? selectedOption.name : placeholder}
        </span>
        {dropdownArrow && (
          <ChevronDown className={cn("h-2.5 w-2.5", dropdownArrowClassName)} aria-hidden="true" />
        )}
      </DropdownButton>
    );
  }, [
    button,
    buttonClassName,
    buttonVariant,
    dropdownArrow,
    dropdownArrowClassName,
    hideIcon,
    isOpen,
    placeholder,
    selectedOption,
    showTooltip,
    t,
  ]);

  if (isLoading) return <Loader className="h-3 w-3" />;

  return (
    <ComboDropDown
      as="div"
      className={cn("h-full", className)}
      tabIndex={tabIndex}
      value={value}
      onChange={onChange}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      button={
        <div
          className={cn("clickable w-full", buttonContainerClassName)}
          onClick={handleOnClick}
        >
          {ButtonToRender}
        </div>
      }
      options={dropdownOptions}
      placement={placement}
      closeOnSelect
      searchQuery={searchQuery}
      setQuery={setSearchQuery}
      searchInputKeyDown={searchInputKeyDown}
      optionsClassName="w-full"
      noOptionsMessage={() => t("no_matching_results")}
    />
  );
});