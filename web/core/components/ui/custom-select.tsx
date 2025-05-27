import React from "react";
import { Input } from "@plane/ui";

type Props = {
  value: any;
  onChange: (value: any) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isMulti?: boolean;
};

export const CustomSelect: React.FC<Props> = (props) => {
  const { value, onChange, options, placeholder, className, disabled, isMulti } = props;

  return (
    <Input
      type="select"
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      multiple={isMulti}
    />
  );
}; 