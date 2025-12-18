import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// ui
import { Button, Input, ModalCore, EModalPosition, EModalWidth, TextArea, ToggleSwitch } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { IWorkflowTemplate, IWorkflowTemplateFormData } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflow?: IWorkflowTemplate | null;
}

export const WorkflowTemplateModal = observer(({ isOpen, onClose, workflow }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { createWorkflowTemplate, updateWorkflowTemplate, applyWorkflowToAllIssues } = useWorkflow();

  // form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IWorkflowTemplateFormData>({
    defaultValues: {
      name: workflow?.name || "",
      description: workflow?.description || "",
      is_active: workflow?.is_active || false,
      is_default: workflow?.is_default || false,
    },
  });

  React.useEffect(() => {
    if (workflow) {
      reset({
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.is_active,
        is_default: workflow.is_default,
      });
    } else {
      reset({
        name: "",
        description: "",
        is_active: false,
        is_default: false,
      });
    }
  }, [workflow, reset]);

  const onSubmit = async (data: IWorkflowTemplateFormData) => {
    if (!workspaceSlug || !projectId) return;

    try {
      if (workflow) {
        await updateWorkflowTemplate(workspaceSlug as string, projectId as string, workflow.id, data);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "워크플로우가 수정되었습니다.",
        });
      } else {
        await createWorkflowTemplate(workspaceSlug as string, projectId as string, data);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "워크플로우가 생성되었습니다.",
        });
      }
      onClose();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: workflow ? "워크플로우 수정에 실패했습니다." : "워크플로우 생성에 실패했습니다.",
      });
    }
  };

  const handleApplyToAllIssues = async () => {
    if (!workspaceSlug || !projectId || !workflow) return;

    if (!confirm("프로젝트의 모든 이슈에 이 워크플로우를 적용하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    try {
      const result = await applyWorkflowToAllIssues(workspaceSlug as string, projectId as string, workflow.id);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크플로우 적용 완료",
        message: `${result.updated_count}개의 이슈에 워크플로우가 적용되었습니다.`,
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크플로우 적용 실패",
        message: "모든 이슈에 워크플로우를 적용하는 중 오류가 발생했습니다.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="p-5">
        <div className="mb-5">
          <h3 className="text-lg font-medium text-custom-text-100">{workflow ? "워크플로우 수정" : "새 워크플로우"}</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 mb-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-custom-text-200 mb-2">
                워크플로우 이름 *
              </label>
              <Controller
                name="name"
                control={control}
                rules={{ required: "워크플로우 이름을 입력해주세요" }}
                render={({ field }) => (
                  <Input {...field} placeholder="워크플로우 이름을 입력하세요" hasError={!!errors.name} />
                )}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-custom-text-200 mb-2">
                설명
              </label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextArea
                    {...field}
                    placeholder="워크플로우에 대한 설명을 입력하세요"
                    rows={6}
                    className="min-h-[120px]"
                  />
                )}
              />
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-custom-text-100">활성 상태</h4>
                  <p className="text-sm text-custom-text-200">워크플로우를 즉시 활성화합니다</p>
                </div>
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <ToggleSwitch value={value ?? false} onChange={onChange} />
                  )}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-custom-text-100">기본 워크플로우</h4>
                  <p className="text-sm text-custom-text-200">새 이슈에 자동으로 적용됩니다</p>
                </div>
                <Controller
                  name="is_default"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <ToggleSwitch value={value ?? false} onChange={onChange} />
                  )}
                />
              </div>
            </div>

            {/* Apply to all issues section - only show for existing workflows */}
            {workflow && (
              <div className="border-t pt-4">
                <div className="rounded-lg bg-yellow-50 p-4">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-yellow-800">모든 이슈에 워크플로우 적용</h4>
                      <p className="mt-1 text-sm text-yellow-700">
                        프로젝트의 모든 기존 이슈에 이 워크플로우를 적용합니다. 이 작업은 되돌릴 수 없습니다.
                      </p>
                    </div>
                    <Button
                      variant="neutral-primary"
                      size="sm"
                      onClick={handleApplyToAllIssues}
                      className="ml-4 flex-shrink-0"
                    >
                      모든 이슈에 적용
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="neutral-primary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              {workflow ? "수정" : "생성"}
            </Button>
          </div>
        </form>
      </div>
    </ModalCore>
  );
});
