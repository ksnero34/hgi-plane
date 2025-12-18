import { useState, useEffect } from "react";
import { useTranslation } from "@plane/i18n";
import { convertMinutesToHoursAndMinutes } from "@plane/utils";

export type TEstimateTimeInputProps = {
  value?: number;
  handleEstimateInputValue: (value: string) => void;
};

export const EstimateTimeInput = (props: TEstimateTimeInputProps) => {
  const { value, handleEstimateInputValue } = props;
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);

  // i18n
  const { t } = useTranslation();

  // Initialize hours and minutes from value
  useEffect(() => {
    if (value !== undefined) {
      const { hours: h, minutes: m } = convertMinutesToHoursAndMinutes(value);
      setHours(h);
      setMinutes(m);

      // Log for debugging
      console.log("Initial value:", value, "Converted to", h, "hours", m, "minutes");
    }
  }, [value]);

  // Update the total value when hours or minutes change
  const handleTimeChange = (newHours: number, newMinutes: number) => {
    // Ensure we have at least 1 minute if both are zero
    if (newHours === 0 && newMinutes === 0) {
      newMinutes = 1;
    }

    setHours(newHours);
    setMinutes(newMinutes);

    // Calculate total minutes
    const totalMinutes = newHours * 60 + newMinutes;

    // Log for debugging
    console.log("New time values:", newHours, "hours", newMinutes, "minutes", "Total:", totalMinutes);

    // Always pass a positive number as a string
    handleEstimateInputValue(String(totalMinutes));

    // Log what was passed to the handler
    console.log("Passed to handler:", String(totalMinutes));
  };

  return (
    <div className="flex items-center space-x-2 w-full">
      <input
        value={hours}
        onChange={(e) => {
          const newValue = e.target.value;
          const newHours = newValue === "" ? 0 : parseInt(newValue);
          if (!isNaN(newHours) && newHours >= 0) {
            handleTimeChange(newHours, minutes);
          }
        }}
        className="border-none focus:ring-0 focus:border-0 focus:outline-none px-2 py-2 w-1/3 bg-transparent text-sm"
        placeholder="0"
        autoFocus
        type="number"
        min="0"
      />
      <span>시간</span>
      <input
        value={minutes}
        onChange={(e) => {
          const newValue = e.target.value;
          const newMinutes = newValue === "" ? 0 : parseInt(newValue);
          if (!isNaN(newMinutes) && newMinutes >= 0 && newMinutes < 60) {
            handleTimeChange(hours, newMinutes);
          }
        }}
        className="border-none focus:ring-0 focus:border-0 focus:outline-none px-2 py-2 w-1/3 bg-transparent text-sm"
        placeholder="0"
        type="number"
        min="0"
        max="59"
      />
      <span>분</span>
    </div>
  );
};
