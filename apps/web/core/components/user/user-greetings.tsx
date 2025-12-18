// plane types
import { useTranslation } from "@plane/i18n";
// hooks
import type { IUser } from "@plane/types";
import { useCurrentTime } from "@/hooks/use-current-time";
// types

export interface IUserGreetingsView {
  user: IUser;
}

export function UserGreetingsView(props: IUserGreetingsView) {
  const { user } = props;
  // current time hook
  const { currentTime } = useCurrentTime();
  // store hooks
  const { t } = useTranslation();

  const hour = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "numeric",
  }).format(currentTime);

  const date = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(currentTime);

  const weekDay = new Intl.DateTimeFormat("ko-KR", {
    weekday: "long",
  }).format(currentTime);

  const timeString = new Intl.DateTimeFormat("ko-KR", {
    timeZone: user?.user_timezone,
    hour12: false, // Use 24-hour format
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime);

  const greeting =
    parseInt(hour, 10) < 6
      ? "dawn"
      : parseInt(hour, 10) < 12
        ? "morning"
        : parseInt(hour, 10) < 18
          ? "afternoon"
          : "evening";

  return (
    <div>
      <h3 className="text-xl font-semibold">
        Good {greeting}, {user?.first_name} 님
      </h3>
      <h6 className="flex items-center gap-2 font-medium text-custom-text-400">
        <div>{greeting === "dawn" ? "🌃" : greeting === "morning" ? "🌤️" : greeting === "afternoon" ? "🌥️" : "🌙️"}</div>
        <div>
          {date} {weekDay} {timeString}
        </div>
      </h6>
    </div>
  );
}
