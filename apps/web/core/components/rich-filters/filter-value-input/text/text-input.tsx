import React, { useMemo } from "react";
import { observer } from "mobx-react";
// plane imports
import type {
  TFilterConditionNodeForDisplay,
  TFilterProperty,
  TTextFilterFieldConfig,
} from "@plane/types";
import { Input } from "@plane/ui";
import { cn } from "@plane/utils";
// local imports
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME, EMPTY_FILTER_PLACEHOLDER_TEXT } from "../../shared";

type TTextFilterValueInputProps<P extends TFilterProperty> = {
  config: TTextFilterFieldConfig<string>;
  condition: TFilterConditionNodeForDisplay<P, string>;
  isDisabled?: boolean;
  onChange: (value: string | null) => void;
};

export const TextFilterValueInput = observer(
  <P extends TFilterProperty>(props: TTextFilterValueInputProps<P>) => {
    const { config, condition, isDisabled, onChange } = props;
    const placeholder = config.placeholder ?? EMPTY_FILTER_PLACEHOLDER_TEXT;

    const inputValue = useMemo(() => {
      if (typeof condition.value === "string") {
        return condition.value;
      }
      if (typeof config.defaultValue === "string") {
        return config.defaultValue;
      }
      return "";
    }, [condition.value, config.defaultValue]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return;

      const nextValue = event.target.value;
      onChange(nextValue);
    };

    return (
      <Input
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={isDisabled}
        inputSize="sm"
        mode="true-transparent"
        className={cn(
          "h-full w-full rounded-none border-none px-4 text-sm transition-colors duration-200 focus:ring-0",
          !isDisabled && COMMON_FILTER_ITEM_BORDER_CLASSNAME,
          isDisabled && "cursor-not-allowed text-custom-text-400 hover:bg-custom-background-100",
          !inputValue && "text-custom-text-400"
        )}
      />
    );
  }
);
