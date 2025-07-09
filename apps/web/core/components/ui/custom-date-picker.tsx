import React from "react";
import { Input } from "@plane/ui";

type Props = {
  value: string | null;
  onChange: (date: string | null) => void;
  className?: string;
  disabled?: boolean;
};

export const CustomDatePicker: React.FC<Props> = (props) => {
  const { value, onChange, className, disabled } = props;

  return (
    <Input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={className}
      disabled={disabled}
    />
  );
}; 