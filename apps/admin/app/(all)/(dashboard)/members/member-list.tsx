import type { FC } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { User, ChevronUp, ChevronDown } from "lucide-react";
import type { IUser } from "@plane/types";
import { Avatar, ToggleSwitch } from "@plane/ui";
import { useUser } from "@/hooks/store";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

const formatRelativeTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const target = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(target.getTime())) return "-";

  const diffInSeconds = Math.round((target.getTime() - Date.now()) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  const thresholds: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { limit: 60, divisor: 1, unit: "second" },
    { limit: 3600, divisor: 60, unit: "minute" },
    { limit: 86400, divisor: 3600, unit: "hour" },
    { limit: 604800, divisor: 86400, unit: "day" },
    { limit: 2629800, divisor: 604800, unit: "week" },
    { limit: 31557600, divisor: 2629800, unit: "month" },
    { limit: Number.POSITIVE_INFINITY, divisor: 31557600, unit: "year" },
  ];

  for (const { limit, divisor, unit } of thresholds) {
    if (absDiff < limit) {
      const value = Math.round(diffInSeconds / divisor);
      return relativeTimeFormatter.format(value, unit);
    }
  }

  return "-";
};

type TSortKey = "display_name" | "email" | "date_joined" | "last_active" | "is_instance_admin";
type TSortOrder = "asc" | "desc";

export interface IMemberList {
  members: IUser[];
  onUpdateMember: (userId: string, isInstanceAdmin: boolean) => void;
}

export const MemberList: FC<IMemberList> = observer(({ members, onUpdateMember }) => {
  const { currentUser } = useUser();
  const [sortKey, setSortKey] = useState<TSortKey>("display_name");
  const [sortOrder, setSortOrder] = useState<TSortOrder>("asc");

  const handleSort = (key: TSortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;

    let compareA: any = a[sortKey];
    let compareB: any = b[sortKey];

    if (sortKey === "date_joined" || sortKey === "last_active") {
      compareA = new Date(compareA || 0).getTime();
      compareB = new Date(compareB || 0).getTime();
    }

    if (compareA < compareB) return sortOrder === "asc" ? -1 : 1;
    if (compareA > compareB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ currentKey }: { currentKey: TSortKey }) => {
    if (sortKey !== currentKey) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-custom-border-200">
        <thead>
          <tr className="bg-custom-background-90">
            <th
              className="px-4 py-3 text-left text-xs font-medium text-custom-text-200 cursor-pointer"
              onClick={() => handleSort("display_name")}
            >
              <div className="flex items-center gap-x-2">
                이름
                <SortIcon currentKey="display_name" />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-custom-text-200 cursor-pointer"
              onClick={() => handleSort("email")}
            >
              <div className="flex items-center gap-x-2">
                이메일
                <SortIcon currentKey="email" />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-custom-text-200 cursor-pointer"
              onClick={() => handleSort("date_joined")}
            >
              <div className="flex items-center gap-x-2">
                가입일시
                <SortIcon currentKey="date_joined" />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-custom-text-200 cursor-pointer"
              onClick={() => handleSort("last_active")}
            >
              <div className="flex items-center gap-x-2">
                최근 접속
                <SortIcon currentKey="last_active" />
              </div>
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-custom-text-200 cursor-pointer"
              onClick={() => handleSort("is_instance_admin")}
            >
              <div className="flex items-center gap-x-2">
                권한
                <SortIcon currentKey="is_instance_admin" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-custom-border-200">
          <>
            {sortedMembers.map((member) => (
              <tr key={member.id} className={`${member.id === currentUser?.id ? "bg-custom-background-80" : ""}`}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-x-3">
                    <Avatar name={member.display_name} src={member.avatar_url || undefined} size={32} shape="square" />
                    <span className="text-sm font-medium">{member.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-custom-text-200">{member.email}</td>
                <td className="px-4 py-3 text-sm text-custom-text-200">{formatRelativeTime(member.date_joined)}</td>
                <td className="px-4 py-3 text-sm text-custom-text-200">
                  {member.last_active ? formatRelativeTime(member.last_active) : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <User
                        className={`h-4 w-4 ${member.is_instance_admin ? "text-custom-primary-100" : "text-custom-text-200"}`}
                      />
                      <span
                        className={`text-sm ${member.is_instance_admin ? "text-custom-primary-100 font-medium" : "text-custom-text-200"}`}
                      >
                        {member.is_instance_admin ? "관리자" : "멤버"}
                      </span>
                    </div>
                    <ToggleSwitch
                      value={member.is_instance_admin}
                      onChange={() => onUpdateMember(member.id, !member.is_instance_admin)}
                      size="sm"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </>
        </tbody>
      </table>
    </div>
  );
});
