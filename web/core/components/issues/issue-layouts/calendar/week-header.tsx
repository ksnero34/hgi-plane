import { observer } from "mobx-react";

// constants
import { DAYS_LIST } from "@/constants/calendar";

type Props = {
  isLoading: boolean;
  showWeekends: boolean;
};

export const CalendarWeekHeader: React.FC<Props> = observer((props) => {
  const { isLoading, showWeekends } = props;

  return (
    <div
      className={`relative sticky top-0 z-[1] grid md:divide-x-[0.5px] divide-custom-border-200 text-sm font-medium ${
        showWeekends ? "grid-cols-7" : "grid-cols-5"
      }`}
    >
      {isLoading && (
        <div className="absolute h-[1.5px] w-3/4 animate-[bar-loader_2s_linear_infinite] bg-custom-primary-100" />
      )}
      {Object.entries(DAYS_LIST)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([key, day]) => {
          if (!showWeekends && (key === "1" || key === "7")) return null;

          return (
            <div
              key={day.shortTitle}
              className="flex h-11 items-center justify-center md:justify-end bg-custom-background-90 px-4"
            >
              {day.shortTitle}
            </div>
          );
        })}
    </div>
  );
});
