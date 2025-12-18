import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale";
import { ChevronLeftIcon } from "../icons";

import { cn } from "../utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({
  className,
  showOutsideDays = true,
  captionLayout,
  hideNavigation,
  locale = ko,
  ...props
}: CalendarProps) => {
  const currentYear = new Date().getFullYear();
  const thirtyYearsAgoFirstDay = new Date(currentYear - 30, 0, 1);
  const thirtyYearsFromNowFirstDay = new Date(currentYear + 30, 11, 31);

  const computedHideNavigation = hideNavigation ?? captionLayout === "dropdown";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      captionLayout={captionLayout}
      hideNavigation={computedHideNavigation}
      weekStartsOn={props.weekStartsOn}
      locale={locale}
      components={{
        Chevron: ({ className, ...props }) => (
          <ChevronLeftIcon
            className={cn(
              "size-4",
              { "rotate-180": props.orientation === "right", "-rotate-90": props.orientation === "down" },
              className
            )}
            {...props}
          />
        ),
      }}
      startMonth={thirtyYearsAgoFirstDay}
      endMonth={thirtyYearsFromNowFirstDay}
      {...props}
    />
  );
};
