import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import type { Placement } from "@popperjs/core";
import { usePopper } from "react-popper";
import { Tag, Tags, CalendarCheck2, UserCircle2, Users, Settings, Check, Search, X } from "lucide-react";
import { Combobox } from "@headlessui/react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
// ui
import { ComboDropDown, Tooltip } from "@plane/ui";
// types
import type { TCustomField } from "@plane/types";
// helpers
import { cn } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useDropdown } from "@/hooks/use-dropdown";

type Props = {
  field: TCustomField;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  buttonVariant?: "border-with-text" | "border-without-text" | "transparent-with-text" | "transparent-without-text";
  className?: string;
  buttonContainerClassName?: string;
  buttonClassName?: string;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  placeholder?: string;
  showTooltip?: boolean;
  hideIcon?: boolean;
  showFieldNameWhenEmpty?: boolean;
  hideIconWhenEmpty?: boolean;
  onClose?: () => void;
  placement?: Placement;
  maxRender?: number;
};

// 개별 태그 컴포넌트 (툴크 포함, labels의 LabelItem과 유사)
const CustomFieldTag: React.FC<{
  field: TCustomField;
  value: string;
  disabled?: boolean;
}> = ({ field, value, disabled }) => {
  const { isMobile } = usePlatformOS();

  return (
    <Tooltip tooltipHeading={field.name} tooltipContent={value} isMobile={isMobile} renderByDefault={false}>
      <div
        className={cn(
          "flex h-5 flex-shrink-0 items-center gap-1 rounded border-[0.5px] border-custom-border-300 px-1.5 text-xs",
          disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-custom-background-80"
        )}
      >
        <Tags className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={2} />
        <span className="truncate max-w-20">{value}</span>
      </div>
    </Tooltip>
  );
};

// 요약 태그 컴포넌트 (labels의 LabelSummary와 유사)
const CustomFieldSummary: React.FC<{
  field: TCustomField;
  values: string[];
  disabled?: boolean;
}> = ({ field, values, disabled }) => {
  return (
    <div
      className={cn(
        "flex h-5 flex-shrink-0 items-center gap-1.5 rounded border-[0.5px] border-custom-border-300 px-1.5 text-xs",
        disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-custom-background-80"
      )}
    >
      <Tags className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={2} />
      <span className="text-custom-text-200">{values.length}개 선택됨</span>
    </div>
  );
};

// 옵션 컴포넌트
const CustomFieldOptions: React.FC<{
  field: TCustomField;
  isOpen: boolean;
  referenceElement: HTMLButtonElement | null;
  placement?: Placement;
  multiple?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  onClose?: () => void;
}> = ({ field, isOpen, referenceElement, placement, multiple = false, value, onChange, onClose }) => {
  const [query, setQuery] = useState("");
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isMobile } = usePlatformOS();

  useEffect(() => {
    if (isOpen && !isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMobile]);

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

  const searchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (query !== "" && e.key === "Escape") {
      e.stopPropagation();
      setQuery("");
    }
  };

  const handleSingleSelectChange = (selectedValue: string) => {
    if (!onChange) return;

    if (multiple) {
      // Multiselect 처리
      const currentValues = Array.isArray(value) ? value : [];
      let newValues;

      if (currentValues.includes(selectedValue)) {
        // 이미 선택된 값이면 제거
        newValues = currentValues.filter((v) => v !== selectedValue);
      } else {
        // 선택되지 않은 값이면 추가
        newValues = [...currentValues, selectedValue];
      }

      onChange(newValues.length > 0 ? newValues : null);
    } else {
      // Single select 처리 - labels와 동일하게 동일한 값 클릭시 제거
      if (value === selectedValue) {
        onChange(null); // 동일한 값 클릭시 제거
      } else {
        onChange(selectedValue); // 다른 값 클릭시 선택
      }
      if (onClose) onClose();
    }
  };

  const options = field.options?.map((option) => ({
    value: option,
    query: option,
    content: option,
  }));

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  if (!isOpen) return null;

  return (
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
            placeholder="Search..."
            onKeyDown={searchInputKeyDown}
          />
        </div>
        <div className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
          {filteredOptions ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex w-full cursor-pointer select-none items-center justify-between gap-2 truncate rounded px-1 py-1.5 hover:bg-custom-background-80",
                    multiple && Array.isArray(value) && value.includes(option.value)
                      ? "text-custom-text-100"
                      : !multiple && value === option.value
                        ? "text-custom-text-100"
                        : "text-custom-text-200"
                  )}
                  onClick={() => handleSingleSelectChange(option.value)}
                >
                  <span className="flex-grow truncate">{option.content}</span>
                  {((multiple && Array.isArray(value) && value.includes(option.value)) ||
                    (!multiple && value === option.value)) && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </div>
              ))
            ) : (
              <p className="px-1.5 py-1 italic text-custom-text-400">No matching results</p>
            )
          ) : (
            <p className="px-1.5 py-1 italic text-custom-text-400">Loading...</p>
          )}
        </div>
      </div>
    </Combobox.Options>
  );
};

// 개별 커스텀 필드 드롭다운 컴포넌트 (LabelDropdown과 유사)
const CustomFieldSingleDropdown: React.FC<{
  field: TCustomField;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placement?: Placement;
  onClose?: () => void;
  tag: React.ReactNode;
}> = ({ field, value, onChange, disabled, placement, onClose, tag }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isMobile } = usePlatformOS();

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (isOpen && onClose) onClose();
  };

  const handleClose = () => {
    if (!isOpen) return;
    setIsOpen(false);
    setQuery("");
    if (onClose) onClose();
  };

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDropdown();
  };

  useOutsideClickDetector(dropdownRef, handleClose);

  useEffect(() => {
    if (isOpen && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [isOpen, isMobile]);

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

  const handleSingleSelectChange = (selectedValue: string) => {
    if (!onChange) return;

    const currentValues = Array.isArray(value) ? value : [];
    let newValues;

    if (currentValues.includes(selectedValue)) {
      newValues = currentValues.filter((v) => v !== selectedValue);
    } else {
      newValues = [...currentValues, selectedValue];
    }

    onChange(newValues.length > 0 ? newValues : []);
  };

  const options = field.options?.map((option) => ({
    value: option,
    query: option,
    content: option,
  }));

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const searchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (query !== "" && e.key === "Escape") {
      e.stopPropagation();
      setQuery("");
    }
  };

  return (
    <div ref={dropdownRef} className="h-full">
      <button
        ref={setReferenceElement}
        type="button"
        className="clickable block h-full max-w-full outline-none"
        onClick={handleOnClick}
        disabled={disabled}
      >
        {tag}
      </button>

      {isOpen && (
        <div className="fixed z-10">
          <div
            className="my-1 w-48 rounded border-[0.5px] border-custom-border-300 bg-custom-background-100 px-2 py-2.5 text-xs shadow-custom-shadow-rg focus:outline-none"
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
          >
            <div className="flex items-center gap-1.5 rounded border border-custom-border-100 bg-custom-background-90 px-2">
              <Search className="h-3.5 w-3.5 text-custom-text-400" strokeWidth={1.5} />
              <input
                ref={inputRef}
                className="w-full bg-transparent py-1 text-xs text-custom-text-200 placeholder:text-custom-text-400 focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                onKeyDown={searchInputKeyDown}
              />
            </div>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
              {filteredOptions ? (
                filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      className={cn(
                        "flex w-full cursor-pointer select-none items-center justify-between gap-2 truncate rounded px-1 py-1.5 hover:bg-custom-background-80",
                        Array.isArray(value) && value.includes(option.value)
                          ? "text-custom-text-100"
                          : "text-custom-text-200"
                      )}
                      onClick={() => handleSingleSelectChange(option.value)}
                    >
                      <span className="flex-grow truncate">{option.content}</span>
                      {Array.isArray(value) && value.includes(option.value) && (
                        <Check className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="px-1.5 py-1 italic text-custom-text-400">No matching results</p>
                )
              ) : (
                <p className="px-1.5 py-1 italic text-custom-text-400">Loading...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomFieldDropdown: React.FC<Props> = observer((props) => {
  const {
    field,
    value,
    onChange,
    disabled = false,
    buttonVariant = "border-with-text",
    className = "",
    buttonContainerClassName = "",
    buttonClassName = "",
    dropdownArrow = false,
    dropdownArrowClassName = "",
    placeholder = "",
    showTooltip = false,
    hideIcon = false,
    showFieldNameWhenEmpty = false,
    hideIconWhenEmpty = false,
    onClose,
    placement,
    maxRender = 2,
  } = props;

  // states
  const [isOpen, setIsOpen] = useState(false);
  // refs
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // popper-js refs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  // store hooks
  const { isMobile } = usePlatformOS();

  const { handleClose, handleKeyDown, handleOnClick } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose,
    setIsOpen,
  });

  // MemberDropdown과 동일한 패턴으로 dropdownOnChange 추가
  const dropdownOnChange = (val: any) => {
    onChange(val);
    if (field.field_type !== "multiselect") handleClose();
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "select":
        return <Tag className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "multiselect":
        return <Tags className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "date":
        return <CalendarCheck2 className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "project_member":
        return <UserCircle2 className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      case "project_members":
        return <Users className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
      default:
        return <Settings className="h-3 w-3 flex-shrink-0" strokeWidth={2} />;
    }
  };

  // MULTISELECT 타입 - labels 패턴을 따라 구현
  if (field.field_type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value : [];
    const hasValue = selectedValues.length > 0;

    if (!hasValue) {
      // 값이 없을 때 - showFieldNameWhenEmpty가 true면 아이콘과 속성명 모두 표시, 아니면 기존 로직
      const comboButton = (
        <button
          ref={setReferenceElement}
          type="button"
          className={cn(
            "clickable block h-full max-w-full outline-none",
            {
              "cursor-not-allowed text-custom-text-200": disabled,
              "cursor-pointer": !disabled,
              "border border-custom-border-300 rounded": buttonVariant === "border-with-text",
              "hover:bg-custom-background-80": !disabled,
            },
            buttonContainerClassName,
            buttonClassName
          )}
          onClick={handleOnClick}
          disabled={disabled}
        >
          {showFieldNameWhenEmpty ? (
            hideIconWhenEmpty ? (
              <div
                className={`flex items-center justify-start w-full ${buttonVariant === "border-with-text" ? "px-2 py-1" : ""}`}
              >
                <span className="truncate">{field.name}</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 ${buttonVariant === "border-with-text" ? "px-2 py-1" : ""}`}>
                {getFieldIcon(field.field_type)}
                <span className="truncate">{field.name}</span>
              </div>
            )
          ) : hideIcon ? (
            <div
              className={`flex items-center justify-start w-full ${buttonVariant === "border-with-text" ? "px-2 py-1" : ""}`}
            >
              <span className="truncate">{placeholder || field.name}</span>
            </div>
          ) : (
            <div
              className={`flex items-center justify-center ${buttonVariant === "border-with-text" ? "px-2 py-1" : ""}`}
            >
              {getFieldIcon(field.field_type)}
            </div>
          )}
        </button>
      );

      const tooltipWrappedButton = showTooltip ? (
        <Tooltip tooltipHeading={field.name} tooltipContent="none" isMobile={isMobile} renderByDefault={false}>
          {comboButton}
        </Tooltip>
      ) : (
        comboButton
      );

      return (
        <ComboDropDown
          as="div"
          ref={dropdownRef}
          className={cn("h-full", className)}
          onKeyDown={handleKeyDown}
          button={tooltipWrappedButton}
          value={selectedValues}
          onChange={dropdownOnChange}
          disabled={disabled}
          multiple={true}
        >
          <CustomFieldOptions
            field={field}
            isOpen={isOpen}
            referenceElement={referenceElement}
            placement={placement}
            multiple={true}
            value={value}
            onChange={dropdownOnChange}
            onClose={handleClose}
          />
        </ComboDropDown>
      );
    }

    // 값이 있을 때는 labels 패턴을 따라 렌더링
    if (selectedValues.length <= maxRender) {
      // 개별 태그들을 각각 별도의 드롭다운으로 렌더링 (labels와 동일한 패턴)
      return (
        <>
          {selectedValues.map((val) => (
            <CustomFieldSingleDropdown
              key={val}
              field={field}
              value={selectedValues}
              onChange={onChange}
              disabled={disabled}
              placement={placement}
              onClose={onClose}
              tag={<CustomFieldTag field={field} value={val} disabled={disabled} />}
            />
          ))}
        </>
      );
    } else {
      // 값이 많을 때는 요약으로 표시
      return (
        <CustomFieldSingleDropdown
          field={field}
          value={selectedValues}
          onChange={onChange}
          disabled={disabled}
          placement={placement}
          onClose={onClose}
          tag={<CustomFieldSummary field={field} values={selectedValues} disabled={disabled} />}
        />
      );
    }
  }

  // SELECT 타입 처리
  if (field.field_type === "select") {
    const hasValue = value && value !== "";
    const showText =
      (buttonVariant === "border-with-text" || buttonVariant === "transparent-with-text") &&
      (hasValue || showFieldNameWhenEmpty);

    const comboboxProps: any = {
      value,
      onChange: dropdownOnChange,
      disabled,
    };

    const comboButton = (
      <button
        ref={setReferenceElement}
        type="button"
        className={cn(
          "clickable block h-full max-w-full outline-none",
          {
            "cursor-not-allowed text-custom-text-200": disabled,
            "cursor-pointer": !disabled,
            "border border-custom-border-300 rounded": buttonVariant === "border-with-text",
            "hover:bg-custom-background-80": !disabled,
          },
          buttonContainerClassName,
          buttonClassName
        )}
        onClick={handleOnClick}
        disabled={disabled}
      >
        <div
          className={`flex items-center ${showText ? "gap-1.5" : "justify-center"} ${buttonVariant === "border-with-text" ? "px-2 py-1" : ""}`}
        >
          {(!hideIconWhenEmpty || hasValue) && getFieldIcon(field.field_type)}
          {showText && <span className="truncate">{hasValue ? value : field.name}</span>}
        </div>
      </button>
    );

    const tooltipWrappedButton = showTooltip ? (
      <Tooltip tooltipHeading={field.name} tooltipContent={value || "none"} isMobile={isMobile} renderByDefault={false}>
        {comboButton}
      </Tooltip>
    ) : (
      comboButton
    );

    return (
      <ComboDropDown
        as="div"
        ref={dropdownRef}
        className={cn("h-full", className)}
        onKeyDown={handleKeyDown}
        button={tooltipWrappedButton}
        {...comboboxProps}
      >
        <CustomFieldOptions
          field={field}
          isOpen={isOpen}
          referenceElement={referenceElement}
          placement={placement}
          multiple={false}
          value={value}
          onChange={dropdownOnChange}
          onClose={handleClose}
        />
      </ComboDropDown>
    );
  }

  // 다른 타입들은 아이콘만 표시
  return (
    <div
      className="flex h-5 flex-shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded border-[0.5px] border-custom-border-300 px-2 py-1"
      title={`${field.name}${value ? `: ${value}` : ""}`}
    >
      {getFieldIcon(field.field_type)}
      {value && <div className="text-xs truncate max-w-20">{value}</div>}
    </div>
  );
});
