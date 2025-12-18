import type { FC } from "react";
import { useState, useEffect } from "react";
// plane types
import { useTranslation } from "@plane/i18n";
import type { IUser } from "@plane/types";
// plane ui
// hooks
import { useCurrentTime } from "@/hooks/use-current-time";

export interface IUserGreetingsView {
  user: IUser;
}

export function UserGreetingsView(props: IUserGreetingsView) {
  const { user } = props;
  // current time hook
  const { currentTime } = useCurrentTime();
  // store hooks
  const { t } = useTranslation();

  const hour = new Intl.DateTimeFormat("ko-KR", {
    timeZone: user?.user_timezone,
    hour12: false,
    hour: "numeric",
  }).format(currentTime);

  const dateString = new Intl.DateTimeFormat("ko-KR", {
    timeZone: user?.user_timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(currentTime);

  const weekDay = new Intl.DateTimeFormat("ko-KR", {
    timeZone: user?.user_timezone,
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

  // Random welcome messages
  const welcomeMessages = [
    "오늘도 좋은 하루 되세요!",
    "새로운 프로젝트를 시작해볼까요?",
    "멋진 아이디어가 기다리고 있어요!",
    "창의적인 작업을 시작해보세요!",
    "오늘은 어떤 일을 해볼까요?",
    "함께 만들어가는 즐거운 하루!",
    "새로운 도전이 당신을 기다리고 있습니다!",
  ];

  const [randomMessage, setRandomMessage] = useState("");

  useEffect(() => {
    setRandomMessage(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);
  }, []);

  return (
    <div className="flex flex-col my-6">
      <h2 className="text-2xl font-semibold">
        {t("good")} {t(greeting)}, {user?.first_name} 님
      </h2>
      <p className="text-base text-custom-text-300 mt-2 mb-4">{randomMessage}</p>
      <h5 className="flex items-center gap-2 font-medium text-custom-text-400">
        <div>{greeting === "dawn" ? "🌃" : greeting === "morning" ? "🌤️" : greeting === "afternoon" ? "🌥️" : "🌙️"}</div>
        <div>{`${dateString} ${weekDay} ${timeString}`}</div>
      </h5>
    </div>
  );
}
