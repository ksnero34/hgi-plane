import { FC, useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";

// ui
import { Button, Input, CustomSelect } from "@plane/ui";

interface IWorkspace {
  id: string;
  name: string;
  slug: string;
}

interface IWorkspaceConfig {
  id?: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: number;
}

interface IWorkspaceFormProps {
  handleFormSubmit: (values: {
    workspace_id: string;
    role: number;
  }) => Promise<void>;
  handleClose: () => void;
  selectedWorkspaceConfig?: IWorkspaceConfig | null;
  workspaces: IWorkspace[];
}

type FormValues = {
  workspace_id: string;
  role: number;
};

const roleOptions = [
  { value: 20, label: "Admin" },
  { value: 15, label: "Member" },
  { value: 10, label: "Viewer" },
  { value: 8, label: "Restricted" },
  { value: 5, label: "Guest" },
];

export const WorkspaceForm: FC<IWorkspaceFormProps> = observer((props) => {
  const { handleFormSubmit, handleClose, selectedWorkspaceConfig, workspaces } =
    props;

  const {
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
    reset,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      workspace_id: "",
      role: 20,
    },
  });

  useEffect(() => {
    if (selectedWorkspaceConfig) {
      setValue("workspace_id", selectedWorkspaceConfig.workspace.id);
      setValue("role", selectedWorkspaceConfig.role);
    } else {
      reset({
        workspace_id: "",
        role: 20,
      });
    }
  }, [selectedWorkspaceConfig, setValue, reset]);

  const onSubmit = async (formData: FormValues) => {
    await handleFormSubmit(formData);
    handleClose();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-5">
        <div>
          <Controller
            control={control}
            name="workspace_id"
            rules={{ required: "워크스페이스는 필수입니다" }}
            render={({ field: { value, onChange } }) => (
              <CustomSelect
                label={
                  <div className={`${errors.workspace_id ? "text-red-500" : ""}`}>
                    워크스페이스
                  </div>
                }
                value={value}
                onChange={onChange}
              >
                {workspaces.map((workspace) => (
                  <CustomSelect.Option key={workspace.id} value={workspace.id}>
                    <div className="flex items-center gap-2">
                      <span>{workspace.name}</span>
                      <span className="text-xs text-custom-text-300">
                        ({workspace.slug})
                      </span>
                    </div>
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            )}
          />
        </div>

        <div>
          <Controller
            control={control}
            name="role"
            rules={{ required: "역할은 필수입니다" }}
            render={({ field: { value, onChange } }) => (
              <CustomSelect
                label={
                  <div className={`${errors.role ? "text-red-500" : ""}`}>
                    역할
                  </div>
                }
                value={value}
                onChange={onChange}
              >
                {roleOptions.map((option) => (
                  <CustomSelect.Option key={option.value} value={option.value}>
                    {option.label}
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <Button variant="neutral-primary" onClick={handleClose}>
          취소
        </Button>
        <Button variant="primary" type="submit" loading={isSubmitting}>
          {selectedWorkspaceConfig ? "업데이트" : "생성"}
        </Button>
      </div>
    </form>
  );
}); 