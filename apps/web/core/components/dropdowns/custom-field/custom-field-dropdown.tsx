import { useRef, useState } from "react";
import { observer } from "mobx-react";
import {
  ChevronDown,
  Search,
  Tag,
  CalendarCheck2,
  UserCircle2,
  Users,
  Settings,
  Type,
  MessageSquare,
} from "lucide-react";
import { Combobox } from "@headlessui/react";
import { usePopper } from "react-popper";
import { useTranslation } from "@plane/i18n";
// ui
import { ComboDropDown } from "@plane/ui";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
// components
import { DropdownButton } from "../buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "../constants";
// types
import { TDropdownProps } from "../types";
import type { TCustomField } from "@plane/types";

type Props = TDropdownProps & {
  button?: React.ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  field: TCustomField;
  onChange: (val: any) => void;
  onClose?: () => void;
  value: any;
  renderByDefault?: boolean;
  placeholder?: string;
  showPlaceholder?: boolean;
};

export const CustomFieldDropdown: React.FC<Props> = observer((props) => {
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
    field,
    onChange,
    onClose,
    placement,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
    placeholder,
    showPlaceholder = false,
  } = props;

  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // refs
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // popper-js refs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLUListElement | null>(null);
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

  const { t } = useTranslation();

  // 필드 타입에 따른 옵션 생성
  const getOptions = () => {
    if (field.field_type === "select" || field.field_type === "multiselect") {
      return (
        field.options?.map((option) => ({
          value: option,
          query: option,
          content: (
            <div className="flex items-center gap-2">
              <span className="flex-grow truncate">{option}</span>
            </div>
          ),
        })) || []
      );
    }
    return [];
  };

  const options = getOptions();
  const filteredOptions =
    query === "" ? options : options.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const { handleClose, handleKeyDown, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose,
    query,
    setIsOpen,
    setQuery,
  });

  const dropdownOnChange = (val: any) => {
    onChange(val);
    if (field.field_type !== "multiselect") {
      handleClose();
    }
  };

  // 표시할 값 계산
  const getDisplayValue = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null; // 값이 없을 때는 null 반환
    }

    if (field.field_type === "multiselect" && Array.isArray(value)) {
      return value.length > 0 ? `${value.length}개 선택됨` : null;
    }

    return value;
  };

  const hasValue = value && (Array.isArray(value) ? value.length > 0 : true);

  const comboButton = (
    <>
      {button ? (
        <button
          ref={setReferenceElement}
          type="button"
          className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
          onClick={handleOnClick}
          disabled={disabled}
          tabIndex={tabIndex}
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
          tabIndex={tabIndex}
        >
          <DropdownButton
            className={cn("text-xs", buttonClassName)}
            isActive={isOpen}
            tooltipHeading={field.name}
            tooltipContent={hasValue ? getDisplayValue() : "none"}
            showTooltip={showTooltip}
            variant={buttonVariant}
            renderToolTipByDefault={renderByDefault}
          >
            {!hideIcon && !hasValue && (
              <div className="flex items-center justify-center">
                {field.field_type === "text" ? (
                  <Type className="h-3 w-3 text-custom-text-400" />
                ) : field.field_type === "select" || field.field_type === "multiselect" ? (
                  <Tag className="h-3 w-3 text-custom-text-400" />
                ) : field.field_type === "date" ? (
                  <CalendarCheck2 className="h-3 w-3 text-custom-text-400" />
                ) : field.field_type === "project_member" ? (
                  <UserCircle2 className="h-3 w-3 text-custom-text-400" />
                ) : field.field_type === "project_members" ? (
                  <Users className="h-3 w-3 text-custom-text-400" />
                ) : (
                  <Settings className="h-3 w-3 text-custom-text-400" />
                )}
              </div>
            )}

            {!hasValue && placeholder && showPlaceholder && (
              <span className="flex-grow truncate text-xs text-custom-text-400 leading-5">{placeholder}</span>
            )}

            {hasValue && (
              <div className="flex items-center gap-1.5">
                {!hideIcon && (
                  <>
                    {field.field_type === "text" ? (
                      <Type className="h-3 w-3 text-custom-text-400" />
                    ) : field.field_type === "select" || field.field_type === "multiselect" ? (
                      <Tag className="h-3 w-3 text-custom-text-400" />
                    ) : field.field_type === "date" ? (
                      <CalendarCheck2 className="h-3 w-3 text-custom-text-400" />
                    ) : field.field_type === "project_member" ? (
                      <UserCircle2 className="h-3 w-3 text-custom-text-400" />
                    ) : field.field_type === "project_members" ? (
                      <Users className="h-3 w-3 text-custom-text-400" />
                    ) : (
                      <Settings className="h-3 w-3 text-custom-text-400" />
                    )}
                  </>
                )}
                <span className="flex-grow truncate leading-5">{getDisplayValue()}</span>
              </div>
            )}

            {dropdownArrow && (
              <ChevronDown className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
            )}
          </DropdownButton>
        </button>
      )}
    </>
  );

  // select/multiselect 타입이 아닌 경우 드롭다운 없이 표시만
  if (field.field_type !== "select" && field.field_type !== "multiselect") {
    return (
      <div className={cn("h-full", className)}>
        <div className="w-full h-full flex items-center gap-1.5 rounded px-2 py-0.5 text-sm justify-between cursor-not-allowed">
          <span className="flex-grow truncate text-xs leading-5">{value || "-"}</span>
        </div>
      </div>
    );
  }

  const comboboxProps: any = {
    value: buttonVariant === "border-without-text" ? null : value,
    onChange: dropdownOnChange,
    disabled,
  };
  if (field.field_type === "multiselect") comboboxProps.multiple = true;

  return (
    <ComboDropDown
      as="div"
      ref={dropdownRef}
      className={cn("h-full", className)}
      onKeyDown={handleKeyDown}
      button={comboButton}
      renderByDefault={renderByDefault}
      {...comboboxProps}
    >
      {isOpen && (
        <Combobox.Options className="fixed z-10" ref={setPopperElement} style={styles.popper} {...attributes.popper}>
          <div className="my-1 w-48 rounded border border-custom-border-300 bg-custom-background-100 px-2 py-2.5 text-xs shadow-custom-shadow-rg focus:outline-none">
            {options.length > 0 && (
              <div className="flex items-center gap-1.5 rounded border border-custom-border-100 bg-custom-background-90 px-2">
                <Search className="h-3.5 w-3.5 text-custom-text-400" strokeWidth={1.5} />
                <Combobox.Input
                  as="input"
                  ref={inputRef}
                  className="w-full bg-transparent py-1 text-xs text-custom-text-200 placeholder:text-custom-text-400 focus:outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="검색..."
                  displayValue={() => ""}
                  onKeyDown={searchInputKeyDown}
                />
              </div>
            )}

            <div className="mt-2 max-h-48 overflow-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <Combobox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active, selected }) =>
                      cn(
                        "flex cursor-pointer select-none items-center justify-between gap-2 truncate rounded px-1 py-1.5",
                        {
                          "bg-custom-background-80": active,
                          "text-custom-text-100": selected,
                          "text-custom-text-200": !selected,
                        }
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        {option.content}
                        {selected && <div className="h-3.5 w-3.5 flex-shrink-0">✓</div>}
                      </>
                    )}
                  </Combobox.Option>
                ))
              ) : (
                <span className="flex items-center gap-2 p-1">
                  <p className="text-left text-custom-text-400">검색 결과가 없습니다</p>
                </span>
              )}
            </div>
          </div>
        </Combobox.Options>
      )}
    </ComboDropDown>
  );
});
