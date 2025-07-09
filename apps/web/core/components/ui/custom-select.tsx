import React from "react";
import { CustomSelect as PlaneCustomSelect } from "@plane/ui";

type Props = {
  value: any;
  onChange: (value: any) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isMulti?: boolean;
  buttonClassName?: string;
};

export const CustomSelect: React.FC<Props> = (props) => {
  const { value, onChange, options, placeholder, className, disabled, buttonClassName } = props;

  return (
    <PlaneCustomSelect
      value={value}
      onChange={onChange}
      label={placeholder}
      className={className}
      disabled={disabled}
      buttonClassName={buttonClassName}
    >
      {options.map((option) => (
        <PlaneCustomSelect.Option key={option.value} value={option.value}>
          {option.label}
        </PlaneCustomSelect.Option>
      ))}
    </PlaneCustomSelect>
  );
}; 