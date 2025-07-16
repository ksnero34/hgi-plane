import React, { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useForm, FormProvider } from "react-hook-form";
import { useParams } from "next/navigation";
// editor
import { EditorRefApi } from "@plane/editor";
// ui
import { Button, ModalCore, EModalWidth, EModalPosition, ToggleSwitch, TOAST_TYPE, setToast } from "@plane/ui";
import { cn, getChangedIssuefields } from "@plane/utils";
// hooks
import { useIssueDetail, useProject } from "@/hooks/store";
// components
import {
  IssueDefaultProperties,
  IssueDescriptionEditor,
  IssueParentTag,
  IssueTitleInput,
} from "@/components/issues/issue-modal/components";
import { CreateLabelModal } from "@/components/labels";
// plane web components
import {
  IssueAdditionalProperties,
  IssueTypeSelect,
} from "@/plane-web/components/issues/issue-modal";

export type TIssueEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  projectId: string;
};

export const IssueEditModal: React.FC<TIssueEditModalProps> = observer((props) => {
  const { isOpen, onClose, issueId, projectId } = props;
  // router
  const { workspaceSlug } = useParams();
  // states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labelModal, setLabelModal] = useState(false);
  const [selectedParentIssue, setSelectedParentIssue] = useState(null);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // store hooks
  const {
    issue: { getIssueById, updateIssue },
  } = useIssueDetail();
  const { getProjectById } = useProject();
  
  // derived values
  const issue = getIssueById(issueId);
  const projectDetails = issue?.project_id ? getProjectById(issue?.project_id) : undefined;

  // form
  const methods = useForm({
    defaultValues: {
      name: "",
      description_html: "<p></p>",
      type_id: "",
      state_id: "",
      priority: null,
      assignee_ids: [],
      label_ids: [],
      start_date: null,
      target_date: null,
      project_id: projectId,
      parent_id: null,
      cycle_id: null,
      module_ids: [],
      estimate_point: null,
      custom_field_values: {},
    },
  });

  const { control, handleSubmit, reset, watch, setValue, getValues, formState: { dirtyFields, isDirty } } = methods;

  // Reset form when issue data is available
  useEffect(() => {
    if (isOpen && issue) {
      reset({
        name: issue.name as any || "",
        description_html: issue.description_html as any || "<p></p>",
        type_id: issue.type_id as any || "",
        state_id: issue.state_id as any || "",
        priority: issue.priority as any || undefined,
        assignee_ids: issue.assignee_ids as any || [],
        label_ids: issue.label_ids as any || [],
        start_date: issue.start_date as any || undefined,
        target_date: issue.target_date as any || undefined,
        project_id: issue.project_id as any || projectId,
        parent_id: issue.parent_id as any || undefined,
        cycle_id: issue.cycle_id as any || undefined,
        module_ids: issue.module_ids as any || [],
        estimate_point: issue.estimate_point as any || undefined,
        custom_field_values: issue.custom_field_values as any || {},
      });
    }
  }, [isOpen, issue, reset, projectId]);

  const onSubmit = async (formData: any) => {
    if (!issue) {
      onClose();
      return;
    }

    // Check if the editor is ready to discard
    if (!editorRef.current?.isEditorReadyToDiscard()) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "편집기가 변경 사항을 처리하고 있습니다. 진행하기 전에 기다려주세요.",
      });
      return;
    }

    // 커스텀 필드 값을 백엔드 형식으로 변환
    const customFieldValues = formData.custom_field_values ? 
      Object.values(formData.custom_field_values).filter((value: any) => value && value.custom_field_id) : [];

    const submitData = {
      ...getChangedIssuefields(formData, dirtyFields as { [key: string]: boolean | undefined }),
      project_id: getValues("project_id"),
      id: issue.id,
      name: formData.name, // 항상 제목 포함
      description_html: formData.description_html ?? "<p></p>", // 항상 내용 포함
      type_id: getValues("type_id"),
      custom_field_values: customFieldValues as any
    };

    setIsSubmitting(true);
    try {
      await updateIssue(workspaceSlug as string, projectId, issueId, submitData as any);
      onClose();
    } catch (error) {
      console.error("Failed to update issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormChange = () => {
    // Handle form changes if needed
  };

  if (!isOpen || !issue) return null;

  const handleModalClose = () => {
    // 모달을 닫지 않도록 빈 함수
  };

  return (
    <FormProvider {...methods}>
      {projectId && (
        <CreateLabelModal
          isOpen={labelModal}
          handleClose={() => setLabelModal(false)}
          projectId={projectId}
          onSuccess={(response) => {
            (setValue as any)("label_ids", [...(watch("label_ids") as any || []), response.id]);
            handleFormChange();
          }}
        />
      )}
      <ModalCore
        isOpen={isOpen}
        handleClose={handleModalClose} // 배경 클릭으로 닫히지 않도록 빈 함수 전달
        position={EModalPosition.TOP}
        width={EModalWidth.XXXXL}
        className="!bg-transparent rounded-lg shadow-none transition-[width] ease-linear"
        style={{ zIndex: 20 }}
      >
        <div className="flex gap-2 bg-transparent" data-prevent-outside-click>
          <div className="rounded-lg w-full">
            <form
              ref={formRef}
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col w-full"
            >
              {/* Header */}
              <div className="p-5 rounded-t-lg bg-custom-background-100">
                <h3 className="text-xl font-medium text-custom-text-200 pb-2">작업 항목 수정</h3>
                <div className="flex items-center justify-between pt-2 pb-4">
                  <div className="flex items-center gap-x-1">
                    <div className="h-7">
                      <div className="h-full flex items-center gap-1.5 border-[0.5px] border-custom-border-300 bg-custom-background-80 rounded text-xs px-2 py-0.5 opacity-60 cursor-not-allowed min-w-max">
                        {projectDetails?.logo_props?.emoji?.value ? (
                          <span className="grid place-items-center flex-shrink-0 h-4 w-4">
                            <div className="emoji-container" style={{ width: '14px', height: '14px' }}>
                              <span className="epr-emoji-native" style={{ fontSize: '14px', height: '14px', width: '14px' }}>
                                {String.fromCodePoint(parseInt(projectDetails.logo_props.emoji.value, 10))}
                              </span>
                            </div>
                          </span>
                        ) : (
                          <span className="grid place-items-center flex-shrink-0 h-4 w-4">
                            <div className="emoji-container" style={{ width: '14px', height: '14px' }}>
                              <span style={{ fontSize: '14px', height: '14px', width: '14px' }}>🔗</span>
                            </div>
                          </span>
                        )}
                        <span className="truncate max-w-40">
                          {projectDetails?.name || "프로젝트"}
                        </span>
                      </div>
                    </div>
                    <span className="text-custom-text-300 text-sm">{">"}</span>
                    <IssueTypeSelect
                      control={control}
                      projectId={projectId}
                      editorRef={editorRef}
                      disabled={false}
                      handleFormChange={handleFormChange}
                    />
                  </div>
                </div>
                {watch("parent_id") && selectedParentIssue && (
                  <div className="pb-4">
                    <IssueParentTag
                      control={control}
                      selectedParentIssue={selectedParentIssue}
                      handleFormChange={handleFormChange}
                      setSelectedParentIssue={setSelectedParentIssue}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <IssueTitleInput
                    control={control}
                    issueTitleRef={null}
                    formState={methods.formState}
                    handleFormChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="pb-4 space-y-3 bg-custom-background-100">
                <div className="px-5">
                  <IssueDescriptionEditor
                    control={control}
                    isDraft={false}
                    issueName={watch("name")}
                    issueId={issue?.id}
                    descriptionHtmlData={issue?.description_html}
                    editorRef={editorRef}
                    submitBtnRef={submitBtnRef}
                    gptAssistantModal={false}
                    workspaceSlug={workspaceSlug?.toString()}
                    projectId={projectId}
                    handleFormChange={handleFormChange}
                    handleDescriptionHTMLDataChange={(description_html) =>
                      setValue("description_html", description_html)
                    }
                    setGptAssistantModal={() => {}}
                    handleGptAssistantClose={() => reset(getValues())}
                    onAssetUpload={() => {}}
                    onClose={onClose}
                  />
                </div>
                <div className="px-5 max-h-[25vh] overflow-hidden overflow-y-auto vertical-scrollbar scrollbar-sm">
                  {projectId && (
                    <IssueAdditionalProperties
                      issueId={issue?.id}
                      issueTypeId={watch("type_id")}
                      projectId={projectId}
                      workspaceSlug={workspaceSlug?.toString()}
                      isDraft={false}
                    />
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t-[0.5px] border-custom-border-200 shadow-custom-shadow-xs rounded-b-lg bg-custom-background-100">
                <div className="pb-3 border-b-[0.5px] border-custom-border-200">
                  <IssueDefaultProperties
                    control={control}
                    id={issue?.id}
                    projectId={projectId}
                    workspaceSlug={workspaceSlug?.toString()}
                    selectedParentIssue={selectedParentIssue}
                    startDate={watch("start_date")}
                    targetDate={watch("target_date")}
                    parentId={watch("parent_id")}
                    isDraft={false}
                    handleFormChange={handleFormChange}
                    setLabelModal={setLabelModal}
                    setSelectedParentIssue={setSelectedParentIssue}
                  />
                </div>
                <div className="flex items-center justify-end gap-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="neutral-primary"
                      size="sm"
                      onClick={() => {
                        if (editorRef.current?.isEditorReadyToDiscard()) {
                          onClose();
                        } else {
                          setToast({
                            type: TOAST_TYPE.ERROR,
                            title: "오류가 발생했습니다!",
                            message: "편집기가 변경 사항을 처리하고 있습니다. 진행하기 전에 기다려주세요.",
                          });
                        }
                      }}
                      type="button"
                    >
                      폐기
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      ref={submitBtnRef}
                    >
                      수정
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </ModalCore>
    </FormProvider>
  );
});