"use client";
import { FC } from "react";
import { observer } from "mobx-react";
import { IInstance, IInstanceAdmin } from "@plane/types";
import { Button, ToggleSwitch } from "@plane/ui";

export interface IMembersConfigurationForm {
  instance: IInstance;
  instanceAdmins: IInstanceAdmin[];
}

export const MembersConfigurationForm: FC<IMembersConfigurationForm> = observer((props) => {
  const { instance, instanceAdmins } = props;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="text-lg font-medium">Instance Members</div>
        <div className="divide-y divide-custom-border-200">
          {instanceAdmins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between py-4">
              <div>
                <div className="text-sm font-medium">{admin.user_detail?.email}</div>
                <div className="text-xs text-custom-text-300">
                  {admin.user_detail?.is_instance_admin ? "Administrator" : "Member"}
                </div>
              </div>
              <ToggleSwitch
                value={admin.user_detail?.is_instance_admin || false}
                onChange={() => {/* TODO: 권한 변경 로직 */}}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});