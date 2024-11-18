"use client";

import { observer } from "mobx-react";
import useSWR from "swr";
import { TOAST_TYPE, setToast } from "@plane/ui";
import { useInstance } from "@/hooks/store";
import { MemberList } from "./member-list";

function MembersPage() {
  const { instance, fetchInstanceMembers, updateInstanceMember } = useInstance();
  const { data: members, isLoading, mutate } = useSWR("INSTANCE_MEMBERS", () => fetchInstanceMembers());

  const handleUpdateMember = async (userId: string, isAdmin: boolean) => {
    try {
      await updateInstanceMember(userId, { is_admin: isAdmin });
      mutate();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message: "Member permissions updated successfully",
      });
    } catch (error) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to update member permissions",
      });
    }
  };

  return (
    <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
      <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
        <div className="text-xl font-medium text-custom-text-100">Members Management</div>
        <div className="text-sm font-normal text-custom-text-300">
          Manage instance members and their permissions. Control who can create workspaces.
        </div>
      </div>
      <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          members && <MemberList members={members} onUpdateMember={handleUpdateMember} />
        )}
      </div>
    </div>
  );
}

export default observer(MembersPage);