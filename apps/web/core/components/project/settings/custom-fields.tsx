import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { Button, Input, CustomSelect, ToggleSwitch, DropIndicator } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TCustomField, TCustomFieldType } from "@plane/types";
import { useCustomField } from "@/hooks/store/use-custom-field";

interface ICustomField {
  id: string;
  name: string;
  key: string;
  description?: string;
  field_type: TCustomFieldType;
  options?: string[];
  is_required: boolean;
  default_value?: any;
  settings?: {
    predefined_values?: string[];
    min_value?: number;
    max_value?: number;
    validation_regex?: string;
  };
  sort_order: number;
}

const FIELD_TYPES: { value: TCustomFieldType; label: string; description: string }[] = [
  { value: "text", label: "Text", description: "일반 텍스트 필드" },
  { value: "number", label: "Number", description: "숫자 값 필드" },
  { value: "date", label: "Date", description: "날짜 선택 필드" },
  { value: "select", label: "Select", description: "단일 선택 드롭다운" },
  { value: "multiselect", label: "Multi-select", description: "다중 선택 드롭다운" },
  { value: "project_member", label: "Project Member", description: "프로젝트 멤버 단일 선택" },
  { value: "project_members", label: "Project Members", description: "프로젝트 멤버 다중 선택" },
];

const CustomFieldItem: React.FC<{
  field: ICustomField;
  index: number;
  onEdit: (field: ICustomField) => void;
  onDelete: (fieldId: string) => void;
}> = ({ field, index, onEdit, onDelete }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [instruction, setInstruction] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ index, id: field.id, type: "custom-field" }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        getData: () => ({ id: field.id, type: "custom-field" }),
        canDrop: ({ source }) => source.data.type === "custom-field",
        getIsSticky: () => true,
        onDragEnter: (args) => setInstruction(args.source.data.id === field.id ? null : { type: "reorder-above" }),
        onDrag: (args) => setInstruction(args.source.data.id === field.id ? null : { type: "reorder-above" }),
        onDragLeave: () => setInstruction(null),
        onDrop: () => setInstruction(null),
      })
    );
  }, [field.id, index]);

  return (
    <div
      ref={elementRef}
      className={`relative flex flex-col gap-4 p-4 border rounded-md ${isDragging ? "opacity-50" : ""}`}
    >
      <DropIndicator isVisible={instruction === "DRAG_OVER"} />
      <div className="w-full grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <div className="text-sm text-custom-text-200">필드명</div>
          <div className="font-medium">{field.name}</div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-custom-text-200">식별자</div>
          <div className="font-medium">{field.key}</div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-custom-text-200">필드 타입</div>
          <div className="font-medium">
            {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-custom-text-200">옵션/값</div>
          <div className="font-medium">
            {field.field_type === "select" || field.field_type === "multiselect"
              ? `${field.options?.length || 0}개 옵션`
              : "없음"}
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-sm text-custom-text-200">필수</div>
          <div className="font-medium">{field.is_required ? "예" : "아니오"}</div>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={() => onEdit(field)}>
            수정
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(field.id)}>
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
};

export const CustomFields: React.FC = observer(() => {
  const { workspaceSlug, projectId } = useParams();
  const { customFields, createCustomField, updateCustomField, deleteCustomField, mutateCustomFields } = useCustomField(
    projectId as string
  );

  const [newField, setNewField] = useState<Partial<ICustomField>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fields = customFields || [];

  const handleCreateOrUpdateField = async () => {
    if (!newField.name || !newField.key) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 이름과 고유 식별자는 필수입니다.",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && newField.id) {
        await updateCustomField(newField.id, newField);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "커스텀 필드가 수정되었습니다.",
        });
      } else {
        await createCustomField(newField);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "새 커스텀 필드가 추가되었습니다.",
        });
      }
      resetForm();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewField({});
    setIsEditMode(false);
  };

  const handleEditField = (field: ICustomField) => {
    setNewField(field);
    setIsEditMode(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
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

  const handleDrop = async (sourceId: string, destinationId: string) => {
    const sourceIndex = fields.findIndex((f) => f.id === sourceId);
    const destinationIndex = fields.findIndex((f) => f.id === destinationId);

    if (sourceIndex === -1 || destinationIndex === -1) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    // 낙관적 업데이트
    mutateCustomFields(items as TCustomField[]);

    try {
      await Promise.all(
        items.map((field, index) =>
          fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${field.id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: index }),
          })
        )
      );
    } catch (error) {
      // 에러 시 원래 상태로 되돌리기
      mutateCustomFields(customFields as TCustomField[]);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to reorder fields.",
      });
    }
  };

  const getFieldPlaceholder = (fieldType: TCustomFieldType) => {
    switch (fieldType) {
      case "text":
        return "예: 버그 설명";
      case "number":
        return "예: 스토리 포인트";
      case "date":
        return "예: 출시일";
      case "select":
      case "multiselect":
        return "예: 우선순위";
      default:
        return "필드 이름";
    }
  };

  const getFieldHelperText = (fieldType: TCustomFieldType) => {
    switch (fieldType) {
      case "text":
        return "이슈에 대한 자세한 설명을 추가할 수 있습니다.";
      case "number":
        return "숫자 값을 입력하여 측정 항목을 관리합니다.";
      case "date":
        return "마감일, 출시일 등 중요한 날짜를 추적합니다.";
      case "select":
        return "하나의 옵션을 선택할 수 있는 드롭다운 목록입니다.";
      case "multiselect":
        return "여러 옵션을 선택할 수 있는 드롭다운 목록입니다.";
      default:
        return "필드의 용도를 입력하세요.";
    }
  };

  const getKeyPlaceholder = (fieldType: TCustomFieldType) => {
    switch (fieldType) {
      case "text":
        return "bug_description";
      case "number":
        return "story_points";
      case "date":
        return "release_date";
      case "select":
      case "multiselect":
        return "priority";
      default:
        return "field_key";
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-2 border-b border-custom-border-100 pb-3.5">
        <h3 className="text-xl font-medium">커스텀 필드 설정</h3>
      </div>

      <div className="mt-6 space-y-8">
        {/* 새 필드 추가 폼 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium">{isEditMode ? "커스텀 필드 수정" : "새 커스텀 필드 추가"}</h4>
            {isEditMode && (
              <Button variant="neutral-primary" onClick={resetForm}>
                취소
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-custom-text-300">필드 이름</label>
              <Input
                value={newField.name}
                onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                placeholder={getFieldPlaceholder(newField.field_type || "text")}
              />
              <p className="text-xs text-custom-text-200">{getFieldHelperText(newField.field_type || "text")}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-custom-text-300">고유 식별자</label>
              <Input
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                placeholder={
                  newField.name
                    ? newField.name.toLowerCase().replace(/\s+/g, "_")
                    : getKeyPlaceholder(newField.field_type || "text")
                }
                disabled={isEditMode}
              />
              <p className="text-xs text-custom-text-200">
                {isEditMode ? "식별자는 수정할 수 없습니다" : "시스템에서 사용될 고유 식별자 (영문, 숫자, _ 만 사용)"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-custom-text-300">필드 타입</label>
              <CustomSelect
                value={newField.field_type}
                label={FIELD_TYPES.find((t) => t.value === newField.field_type)?.label || "필드 타입 선택"}
                onChange={(val: string) => setNewField({ ...newField, field_type: val as TCustomFieldType })}
                buttonClassName="w-full text-left"
              >
                {FIELD_TYPES.map((option) => (
                  <CustomSelect.Option key={option.value} value={option.value}>
                    <div className="flex flex-col gap-1">
                      <span>{option.label}</span>
                      <span className="text-xs text-custom-text-200">{option.description}</span>
                    </div>
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                value={newField.is_required ?? false}
                onChange={(val: boolean) => setNewField({ ...newField, is_required: val })}
              />
              <span className="ml-2">필수 필드</span>
            </div>
          </div>

          {/* 선택/다중선택 타입의 옵션 추가 */}
          {(newField.field_type === "select" || newField.field_type === "multiselect") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">선택 옵션</label>
              <div className="flex flex-wrap gap-2">
                {newField.options?.map((option, index) => (
                  <div key={index} className="flex items-center gap-1 bg-custom-background-80 rounded px-2 py-1">
                    <span className="text-sm">{option}</span>
                    <button
                      className="text-custom-text-200 hover:text-custom-text-100"
                      onClick={() => {
                        const newOptions = [...(newField.options || [])];
                        newOptions.splice(index, 1);
                        setNewField({
                          ...newField,
                          options: newOptions,
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <Input
                  placeholder="새 옵션 추가"
                  className="w-32"
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
              <p className="text-xs text-custom-text-200">Enter 키를 눌러 옵션을 추가하세요</p>
            </div>
          )}

          <Button variant="primary" onClick={handleCreateOrUpdateField} loading={isLoading}>
            {isEditMode ? "필드 수정" : "필드 추가"}
          </Button>
        </div>

        {/* 필드 목록 */}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <CustomFieldItem
              key={field.id}
              field={field}
              index={index}
              onDelete={handleDeleteField}
              onEdit={handleEditField}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
