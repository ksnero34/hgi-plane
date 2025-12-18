import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, Input, CustomSelect, ToggleSwitch } from "@plane/ui";
import { EmojiPicker, EmojiIconPickerTypes } from "@plane/propel/emoji-icon-picker";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IIssueType, IProjectIssueType, TCustomFieldType } from "@plane/types";

// API 응답에 맞춘 확장 타입 - 실제로는 IProjectIssueType과 동일
interface IIssueTypeWithNested extends IProjectIssueType {}
import { useIssueType } from "@/hooks/store/use-issue-type";
import { useCustomField } from "@/hooks/store/use-custom-field";
import { Logo } from "@/components/common/logo";
import { getEmojiImageUrlFromDecimal, getRandomEmoji } from "@plane/utils";

const getDefaultLogoProp = () => {
  const value = getRandomEmoji();
  return {
    in_use: "emoji" as const,
    emoji: {
      value,
      url: getEmojiImageUrlFromDecimal(value),
    },
  };
};

const FIELD_TYPES: { value: TCustomFieldType; label: string; description: string }[] = [
  { value: "text", label: "Text", description: "일반 텍스트 필드" },
  { value: "number", label: "Number", description: "숫자 값 필드" },
  { value: "date", label: "Date", description: "날짜 선택 필드" },
  { value: "select", label: "Select", description: "단일 선택 드롭다운" },
  { value: "multiselect", label: "Multi-select", description: "다중 선택 드롭다운" },
  { value: "project_member", label: "Project Member", description: "프로젝트 멤버 단일 선택" },
  { value: "project_members", label: "Project Members", description: "프로젝트 멤버 다중 선택" },
];

interface IIssueTypeCustomField {
  id?: string;
  name: string;
  key: string;
  description?: string;
  field_type: TCustomFieldType;
  options?: string[];
  is_required: boolean;
  issue_type?: string;
}

const IssueTypeItem: React.FC<{
  issueType: IIssueTypeWithNested;
  projectId: string;
  onEdit: (issueType: IIssueTypeWithNested) => void;
  onDelete: (issueTypeId: string) => void;
}> = ({ issueType, projectId, onEdit, onDelete }) => {
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [customFields, setCustomFields] = useState<IIssueTypeCustomField[]>([]);
  const [newField, setNewField] = useState<Partial<IIssueTypeCustomField>>({});
  const [isAddingField, setIsAddingField] = useState(false);
  const [isEditingField, setIsEditingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const {
    customFields: projectCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getCustomFieldUsageCount,
  } = useCustomField(projectId);

  // 이슈타입별 커스텀 필드 필터링
  const issueTypeCustomFields =
    projectCustomFields?.filter((field) => {
      // API 응답에서 issue_type 필드는 ProjectIssueType.id로 변환되어 반환됨
      // issueType.id는 ProjectIssueType의 ID
      return field.issue_type === issueType.id;
    }) || [];

  const handleAddField = async () => {
    if (!newField.name || !newField.key || !newField.field_type) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 이름, 식별자, 타입은 필수입니다.",
      });
      return;
    }

    try {
      await createCustomField({
        ...newField,
        issue_type: issueType.issue_type.id,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공",
        message: "커스텀 필드가 추가되었습니다.",
      });
      setNewField({});
      setIsAddingField(false);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 추가 중 오류가 발생했습니다.",
      });
    }
  };

  const handleUpdateField = async () => {
    if (!editingFieldId || !newField.name || !newField.key || !newField.field_type) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 이름, 식별자, 타입은 필수입니다.",
      });
      return;
    }

    try {
      await updateCustomField(editingFieldId, newField);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공",
        message: "커스텀 필드가 수정되었습니다.",
      });
      setNewField({});
      setIsEditingField(false);
      setEditingFieldId(null);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 수정 중 오류가 발생했습니다.",
      });
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      // 커스텀 필드 사용량 확인
      const usageCount = await getCustomFieldUsageCount(fieldId);

      if (usageCount.count > 0) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "삭제 불가",
          message: `이 커스텀 필드를 사용하는 이슈가 ${usageCount.count}개 있습니다. 커스텀 필드를 삭제하면 해당 이슈들의 데이터가 영구적으로 손실됩니다.`,
        });

        // 사용량이 있어도 강제 삭제를 원하는지 확인
        const forceDelete = confirm(
          `이 커스텀 필드를 사용하는 이슈가 ${usageCount.count}개 있습니다.\n\n` +
            "삭제하면 해당 이슈들의 커스텀 필드 데이터가 영구적으로 손실되며 복구할 수 없습니다.\n\n" +
            "정말로 삭제하시겠습니까?"
        );

        if (!forceDelete) {
          return;
        }
      } else {
        if (!confirm("이 커스텀 필드를 삭제하시겠습니까?")) {
          return;
        }
      }

      await deleteCustomField(fieldId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공",
        message: "커스텀 필드가 삭제되었습니다.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 삭제 중 오류가 발생했습니다.",
      });
    }
  };

  const handleEditField = (field: any) => {
    setNewField(field);
    setIsEditingField(true);
    setEditingFieldId(field.id);
    setIsAddingField(true);
  };

  const resetFieldForm = () => {
    setNewField({});
    setIsAddingField(false);
    setIsEditingField(false);
    setEditingFieldId(null);
  };

  return (
    <div className="rounded-lg border border-custom-border-200 bg-custom-background-100 overflow-hidden">
      <div className="group flex items-center justify-between p-4 hover:bg-custom-background-90 transition-colors">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-custom-border-200">
            <Logo logo={issueType.issue_type.logo_props || { in_use: "emoji", emoji: { value: "128204" } }} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-custom-text-100 truncate">{issueType.issue_type.name || "제목 없음"}</h4>
              {issueTypeCustomFields.length > 0 && (
                <span className="text-xs bg-custom-background-80 text-custom-text-200 px-2 py-1 rounded-full">
                  {issueTypeCustomFields.length}개 필드
                </span>
              )}
            </div>
            {issueType.issue_type.description && (
              <p className="text-sm text-custom-text-300 truncate mt-1">{issueType.issue_type.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="neutral-primary"
            size="sm"
            onClick={() => setShowCustomFields(!showCustomFields)}
            className="text-xs"
          >
            {showCustomFields ? "필드 숨기기" : "필드 관리"}
          </Button>
          <Button variant="neutral-primary" size="sm" onClick={() => onEdit(issueType)} className="text-xs">
            수정
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(issueType.id)} className="text-xs">
            삭제
          </Button>
        </div>
      </div>

      {showCustomFields && (
        <div className="border-t border-custom-border-200 bg-custom-background-90 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-custom-text-100">커스텀 필드</h5>
              <Button variant="primary" size="sm" onClick={() => setIsAddingField(!isAddingField)} className="text-xs">
                {isAddingField ? "취소" : "필드 추가"}
              </Button>
            </div>

            {isAddingField && (
              <div className="space-y-3 p-3 bg-custom-background-100 rounded-lg border border-custom-border-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-custom-text-300">필드 이름</label>
                    <Input
                      value={newField.name || ""}
                      onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                      placeholder="예: 우선순위"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-custom-text-300">식별자</label>
                    <Input
                      value={newField.key || ""}
                      onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                      placeholder="예: priority"
                      className="text-sm"
                      disabled={isEditingField}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-custom-text-300">필드 타입</label>
                    <CustomSelect
                      value={newField.field_type}
                      label={FIELD_TYPES.find((t) => t.value === newField.field_type)?.label || "타입 선택"}
                      onChange={(val: string) => setNewField({ ...newField, field_type: val as TCustomFieldType })}
                      buttonClassName="w-full text-left text-sm"
                    >
                      {FIELD_TYPES.map((option) => (
                        <CustomSelect.Option key={option.value} value={option.value}>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{option.label}</span>
                            <span className="text-xs text-custom-text-200">{option.description}</span>
                          </div>
                        </CustomSelect.Option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      value={newField.is_required ?? false}
                      onChange={(val: boolean) => setNewField({ ...newField, is_required: val })}
                    />
                    <span className="text-xs text-custom-text-300">필수 필드</span>
                  </div>
                </div>

                {(newField.field_type === "select" || newField.field_type === "multiselect") && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-custom-text-300">선택 옵션</label>
                    <div className="flex flex-wrap gap-2">
                      {newField.options?.map((option, index) => (
                        <div key={index} className="flex items-center gap-1 bg-custom-background-80 rounded px-2 py-1">
                          <span className="text-xs">{option}</span>
                          <button
                            className="text-custom-text-200 hover:text-custom-text-100"
                            onClick={() => {
                              const newOptions = [...(newField.options || [])];
                              newOptions.splice(index, 1);
                              setNewField({ ...newField, options: newOptions });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <Input
                        placeholder="옵션 추가"
                        className="w-24 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
                            setNewField({
                              ...newField,
                              options: [...(newField.options || []), e.currentTarget.value.trim()],
                            });
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button variant="neutral-primary" size="sm" onClick={resetFieldForm} className="text-xs">
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={isEditingField ? handleUpdateField : handleAddField}
                    className="text-xs"
                  >
                    {isEditingField ? "수정" : "추가"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {issueTypeCustomFields.length > 0 ? (
                issueTypeCustomFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-3 bg-custom-background-100 rounded-lg border border-custom-border-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-custom-text-100">{field.name}</span>
                        <span className="text-xs text-custom-text-300">
                          {field.key} • {FIELD_TYPES.find((t) => t.value === field.field_type)?.label}
                        </span>
                      </div>
                      {field.is_required && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">필수</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="neutral-primary"
                        size="sm"
                        onClick={() => handleEditField(field)}
                        className="text-xs"
                      >
                        수정
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteField(field.id)}
                        className="text-xs"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-custom-text-300">
                  이 이슈타입에 대한 커스텀 필드가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const IssueTypes: React.FC = observer(() => {
  const { projectId } = useParams();
  const { issueTypes, createIssueType, updateIssueType, deleteIssueType, getIssueTypeUsageCount } = useIssueType(
    projectId as string
  );

  const [newIssueType, setNewIssueType] = useState<Partial<IIssueType>>(() => ({
    logo_props: getDefaultLogoProp(),
  }));
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateOrUpdate = async () => {
    if (!newIssueType.name?.trim()) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "이슈 타입 이름을 입력해주세요.",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && newIssueType.id) {
        await updateIssueType(newIssueType.id, newIssueType);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "이슈 타입이 성공적으로 수정되었습니다.",
        });
      } else {
        await createIssueType(newIssueType);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "이슈 타입이 성공적으로 생성되었습니다.",
        });
      }
      // Reset form and close
      setNewIssueType(() => ({ logo_props: getDefaultLogoProp() }));
      setIsEditMode(false);
      setIsIconPickerOpen(false);
      setShowCreateForm(false);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "이슈 타입 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewIssueType(() => ({ logo_props: getDefaultLogoProp() }));
    setIsEditMode(false);
    setIsIconPickerOpen(false);
    setShowCreateForm(false);
  };

  const handleEdit = (issueType: IIssueTypeWithNested) => {
    setNewIssueType({
      ...issueType.issue_type,
      id: issueType.id,
    });
    setIsEditMode(true);
    setShowCreateForm(true);
    setIsIconPickerOpen(false);
  };

  const handleDelete = async (issueTypeId: string) => {
    // 삭제하려는 이슈 타입 찾기
    const issueTypeToDelete = issueTypes.find((it) => it.id === issueTypeId);
    if (!issueTypeToDelete) return;

    // 기본 이슈 타입인지 확인
    if (issueTypeToDelete.is_default) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "삭제 불가",
        message: "기본 이슈 타입은 삭제할 수 없습니다.",
      });
      return;
    }

    try {
      // 해당 이슈 타입을 사용하는 이슈 수 확인
      const usageCount = await getIssueTypeUsageCount(issueTypeId);

      if (usageCount.count > 0) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "삭제 불가",
          message: `이 이슈 타입을 사용하는 이슈가 ${usageCount.count}개 있습니다. 먼저 해당 이슈들의 타입을 변경해주세요.`,
        });
        return;
      }

      if (!confirm("이 이슈 타입을 삭제하시겠습니까?")) {
        return;
      }

      await deleteIssueType(issueTypeId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "성공",
        message: "이슈 타입이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "이슈 타입 삭제 중 오류가 발생했습니다.",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-custom-text-100">이슈 타입</h3>
          <p className="text-sm text-custom-text-300">프로젝트에서 사용할 이슈 타입을 관리하세요.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "취소" : "새 이슈 타입 추가"}
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-lg border border-custom-border-200 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-medium text-custom-text-100">
                {isEditMode ? "이슈 타입 수정" : "새 이슈 타입 생성"}
              </h4>
              {isEditMode && (
                <Button variant="neutral-primary" size="sm" onClick={resetForm}>
                  취소
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-custom-text-300">이름 *</label>
                <Input
                  value={newIssueType.name || ""}
                  onChange={(e) => setNewIssueType({ ...newIssueType, name: e.target.value })}
                  placeholder="예: 버그, 기능, 작업"
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-custom-text-300">설명</label>
                <Input
                  value={newIssueType.description || ""}
                  onChange={(e) => setNewIssueType({ ...newIssueType, description: e.target.value })}
                  placeholder="이슈 타입에 대한 간단한 설명"
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-custom-text-300">아이콘</label>
              <div className="flex items-center gap-4">
                <EmojiPicker
                  iconType="material"
                  isOpen={isIconPickerOpen}
                  handleToggle={(val: boolean) => setIsIconPickerOpen(val)}
                  label={
                    <Logo logo={newIssueType.logo_props || { in_use: "emoji", emoji: { value: "128204" } }} size={20} />
                  }
                  buttonClassName="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-custom-border-200 hover:bg-custom-background-90 transition-colors"
                  closeOnSelect
                  onChange={(val) => {
                    if (!val) {
                      setIsIconPickerOpen(false);
                      return;
                    }

                    let logoValue: Record<string, any> = {};
                    if (val?.type === "emoji") {
                      const decimalValue = val.value.decimal;
                      logoValue = {
                        value: decimalValue,
                        url: val.value.imageUrl || getEmojiImageUrlFromDecimal(decimalValue),
                      };
                    } else if (val?.type === "icon") logoValue = val.value;

                    setNewIssueType({
                      ...newIssueType,
                      logo_props: {
                        in_use: val?.type,
                        [val?.type]: logoValue,
                      },
                    });
                    setIsIconPickerOpen(false);
                  }}
                  defaultIconColor={
                    newIssueType.logo_props?.in_use === "icon" ? newIssueType.logo_props?.icon?.color : undefined
                  }
                  defaultOpen={
                    newIssueType.logo_props?.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON
                  }
                />
                <div className="text-sm text-custom-text-400">이슈 타입을 구분할 수 있는 아이콘을 선택하세요</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="neutral-primary"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateOrUpdate}
                loading={isLoading}
                disabled={!newIssueType.name?.trim()}
              >
                {isEditMode ? "수정하기" : "생성하기"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {issueTypes.length > 0 ? (
          issueTypes.map((issueType) => (
            <IssueTypeItem
              key={issueType.id}
              issueType={issueType as IIssueTypeWithNested}
              projectId={projectId as string}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-custom-text-400">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-custom-text-300">이슈 타입이 없습니다</h3>
            <p className="mt-1 text-sm text-custom-text-400">
              새 이슈 타입을 추가해서 프로젝트를 체계적으로 관리하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
