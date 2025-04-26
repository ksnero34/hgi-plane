"use client";

import { ChevronLeft } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ko } from 'date-fns/locale';

import { cn } from "../helpers";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) => {
  const currentYear = new Date().getFullYear();
  const thirtyYearsAgoFirstDay = new Date(currentYear - 30, 0, 1);
  const thirtyYearsFromNowFirstDay = new Date(currentYear + 30, 11, 31);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      locale={ko}
      components={{
        Chevron: ({ className, ...props }) => (
          <ChevronLeft
            className={cn(
              "size-4",
              { "rotate-180": props.orientation === "right", "-rotate-90": props.orientation === "down" },
              className
            )}
            {...props}
          />
        )
      }}
      startMonth={thirtyYearsAgoFirstDay}
      endMonth={thirtyYearsFromNowFirstDay}
      {...props}
    />
  );
};
