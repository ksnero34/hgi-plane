"use client";

import { observer } from "mobx-react";
import { Control, Controller, FieldArrayWithId, FormState } from "react-hook-form";
import { X } from "lucide-react";
// plane imports
import { ROLE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Avatar, CustomSelect, CustomSearchSelect } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useUserPermissions, useMember } from "@/hooks/store";
import { InvitationFormValues } from "@/hooks/use-workspace-invitation";
// helpers
import { getFileURL } from "@/helpers/file.helper";
import { useEffect, useState } from "react";

type TInvitationFieldsProps = {
  workspaceSlug: string;
  fields: FieldArrayWithId<InvitationFormValues, "emails", "id">[];
  control: Control<InvitationFormValues>;
  formState: FormState<InvitationFormValues>;
  remove: (index: number) => void;
  className?: string;
};

export const InvitationFields = observer((props: TInvitationFieldsProps) => {
  const {
    workspaceSlug,
    fields,
    control,
    formState: { errors },
    remove,
    className,
  } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { workspaceInfoBySlug } = useUserPermissions();
  const { 
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
    instance: { instanceMemberIds, getInstanceMemberDetails, fetchInstanceMembers }
  } = useMember();

  // 인스턴스 멤버 조회
  useEffect(() => {
    fetchInstanceMembers();
  }, [fetchInstanceMembers]);

  // derived values
  const currentWorkspaceRole = workspaceInfoBySlug(workspaceSlug.toString())?.role;

  // 워크스페이스에 등록되지 않은 인스턴스 멤버만 필터링
  const uninvitedMembers = instanceMemberIds?.filter((userId) => {
    const isInvited = workspaceMemberIds?.find((u) => u === userId);
    return !isInvited;
  });

  // 멤버 선택 옵션 생성
  const memberOptions = uninvitedMembers?.map((userId) => {
    const memberDetails = getInstanceMemberDetails(userId);
    if (!memberDetails) return null;
    return {
      value: memberDetails.email,
      query: `${memberDetails.first_name} ${memberDetails.last_name} ${memberDetails.display_name.toLowerCase()}`,
      content: (
        <div className="flex w-full items-center gap-2">
          <div className="flex-shrink-0 pt-0.5">
            <Avatar name={memberDetails.display_name} src={getFileURL(memberDetails.avatar)} />
          </div>
          <div className="truncate">
            {memberDetails.display_name} ({memberDetails.email})
          </div>
        </div>
      ),
    };
  }).filter(Boolean) || [];

  const options = [
    ...memberOptions,
    {
      value: "manual_input",
      query: "manual_input",
      isManualInput: true,
      content: (onChange: (value: string) => void) => {
        const [error, setError] = useState<string | null>(null);
        return (
          <div className="flex flex-col w-full gap-2 p-2 border-t border-custom-border-200">
            <div className="text-sm text-custom-text-200">
              {t("workspace_settings.settings.members.modal.manual_input")}
            </div>
            <input
              type="email"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary"
              placeholder="name@company.com"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const email = e.currentTarget.value;
                  if (!email) {
                    setError(t("workspace_settings.settings.members.modal.errors.required"));
                    return;
                  }
                  if (!email.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i)) {
                    setError(t("workspace_settings.settings.members.modal.errors.invalid"));
                    return;
                  }
                  setError(null);
                  onChange(email);
                  e.currentTarget.value = ''; // 입력 필드 초기화
                  
                  // 드롭다운 버튼 클릭하여 닫기
                  const button = document.querySelector('[id^="headlessui-combobox-button-"]');
                  if (button) {
                    button.setAttribute('aria-expanded', 'false');
                    button.setAttribute('data-headlessui-state', '');
                    button.click();
                  }
                  
                  // 포커스 해제
                  e.currentTarget.blur();
                }
              }}
            />
            {error && (
              <div className="text-xs text-red-500">
                {error}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={cn("mb-3 space-y-4", className)}>
      {fields.map((field, index) => (
        <div key={field.id} className="relative group mb-1 flex items-start justify-between gap-x-4 text-sm w-full">
          <div className="flex flex-col gap-1 flex-grow w-full">
            <Controller
              control={control}
              name={`emails.${index}.email`}
              rules={{
                required: t("workspace_settings.settings.members.modal.errors.required"),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t("workspace_settings.settings.members.modal.errors.invalid"),
                },
              }}
              render={({ field: { value, onChange } }) => {
                // 현재 선택된 멤버 찾기
                const selectedMember = memberOptions?.find(option => option.value === value);
                return (
                  <CustomSearchSelect
                    value={value}
                    onChange={(val: string) => {
                      onChange(val);
                    }}
                    options={options.map(option => ({
                      ...option,
                      content: option.isManualInput ? option.content(onChange) : option.content
                    }))}
                    label={selectedMember ? selectedMember.content : value || t("workspace_settings.settings.members.modal.placeholder")}
                    width="w-full"
                    input
                    position="right"
                    enablePortal
                    showSearch
                    onOptionClick={(option) => {
                      if (option.value === "manual_input") {
                        return false; // 수동 입력 옵션 클릭 시 드롭다운이 닫히지 않도록 함
                      }
                      return true;
                    }}
                  />
                );
              }}
            />
            {errors.emails?.[index]?.email && (
              <span className="ml-1 text-xs text-red-500">{errors.emails?.[index]?.email?.message}</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex flex-col gap-1">
              <Controller
                control={control}
                name={`emails.${index}.role`}
                rules={{ required: true }}
                render={({ field: { value, onChange } }) => (
                  <CustomSelect
                    value={value}
                    label={<span className="text-xs sm:text-sm">{ROLE[value]}</span>}
                    onChange={onChange}
                    optionsClassName="w-full"
                    className="flex-grow w-24"
                    input
                  >
                    {Object.entries(ROLE).map(([key, value]) => {
                      if (currentWorkspaceRole && currentWorkspaceRole >= parseInt(key))
                        return (
                          <CustomSelect.Option key={key} value={parseInt(key)}>
                            {value}
                          </CustomSelect.Option>
                        );
                    })}
                  </CustomSelect>
                )}
              />
            </div>
            {fields.length > 1 && (
              <button
                type="button"
                className="flex-shrink-0"
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4 text-custom-text-200" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});