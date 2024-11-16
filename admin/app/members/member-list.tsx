"use client";

import { FC } from "react";
import { observer } from "mobx-react";
import { User } from "lucide-react";
import { Avatar, ToggleSwitch } from "@plane/ui";
import { motion, AnimatePresence } from "framer-motion";
// types
import { IUser } from "@plane/types";
import { useUser } from "@/hooks/store";

export interface IMemberList {
  members: IUser[];
  onUpdateMember: (userId: string, isInstanceAdmin: boolean) => void;
}

export const MemberList: FC<IMemberList> = observer(({ members, onUpdateMember }) => {
  const { currentUser } = useUser();

  // 멤버 정렬 함수
  const sortMembers = (a: IUser, b: IUser) => {
    // 현재 로그인한 사용자를 최상단에 배치
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;

    // is_superuser -> is_instance_admin으로 변경
    if (a.is_instance_admin && !b.is_instance_admin) return -1;
    if (!a.is_instance_admin && b.is_instance_admin) return 1;

    // 같은 권한을 가진 사용자들은 이름순으로 정렬
    return a.display_name.localeCompare(b.display_name);
  };

  const sortedMembers = [...members].sort(sortMembers);

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {sortedMembers.map((member) => (
          <motion.div
            key={member.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
            className={`flex items-center justify-between gap-4 rounded-md border border-custom-border-200 px-4 py-3 
              ${member.id === currentUser?.id ? "bg-custom-background-80" : ""} 
              ${member.is_instance_admin ? "bg-custom-background-90" : ""}`}
          >
            <div className="flex items-center gap-x-4">
              <div className="flex-shrink-0">
                <Avatar
                  name={member.display_name}
                  src={member.avatar}
                  size={32}
                  shape="square"
                  className="!text-base"
                />
              </div>
              <div>
                <h4 className="text-sm font-medium">{member.display_name}</h4>
                <p className="text-xs text-custom-text-200">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-x-4">
              <div className="flex items-center gap-x-2">
                <User className={`h-4 w-4 ${member.is_instance_admin ? "text-custom-primary-100" : "text-custom-text-200"}`} />
                <span className={`text-xs ${member.is_instance_admin ? "text-custom-primary-100 font-medium" : "text-custom-text-200"}`}>
                  {member.is_instance_admin ? "Administrator" : "Member"}
                </span>
              </div>
              <ToggleSwitch
                value={member.is_instance_admin}
                onChange={() => onUpdateMember(member.id, !member.is_instance_admin)}
                size="sm"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});