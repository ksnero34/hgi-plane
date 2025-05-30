"use client";

import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { Button, Input, CustomSelect, ToggleSwitch, TOAST_TYPE, setToast, DropIndicator } from "@plane/ui";
import { useProject } from "@/hooks/store";

interface ICustomField {
  id: string;
  name: string;
  key: string;
  description?: string;
  field_type: string;
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

const FIELD_TYPES = [
  { value: "select", label: "선택", description: "미리 정의된 옵션 중 하나를 선택할 수 있습니다." },
  { value: "multiselect", label: "다중선택", description: "미리 정의된 옵션 중 여러 개를 선택할 수 있습니다." },
  { value: "date", label: "날짜", description: "날짜를 선택할 수 있습니다." },
  { value: "project_member", label: "프로젝트 멤버", description: "프로젝트 멤버 중 한 명을 선택할 수 있습니다." },
  { value: "project_members", label: "프로젝트 멤버(다중)", description: "프로젝트 멤버 중 여러 명을 선택할 수 있습니다." },
];

const CustomFieldItem = observer(({ field, index, onDelete, onEdit }: { field: ICustomField; index: number; onDelete: (id: string) => void; onEdit: (field: ICustomField) => void }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<string | undefined>();
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const initialData = { id: field.id, index };

    return combine(
      draggable({
        element,
        dragHandle: element,
        getInitialData: () => initialData,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        getData: ({ input, element }) => 
          attachInstruction(initialData, {
            input,
            element,
            currentLevel: 1,
            indentPerLevel: 0,
            mode: "standard",
          }),
        onDragEnter: () => setInstruction("DRAG_OVER"),
        onDragLeave: () => setInstruction(undefined),
      })
    );
  }, [field.id, index]);

  return (
    <div ref={elementRef} className={`relative flex flex-col gap-4 p-4 border rounded-md ${isDragging ? "opacity-50" : ""}`}>
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
          <div className="font-medium">{FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}</div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-custom-text-200">옵션/값</div>
          <div className="font-medium">
            {field.field_type === "select" || field.field_type === "multiselect" 
              ? `${field.options?.length || 0}개 옵션`
              : "없음"
            }
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-sm text-custom-text-200">필수</div>
          <div className="font-medium">{field.is_required ? "예" : "아니오"}</div>
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={() => onEdit(field)}>수정</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(field.id)}>삭제</Button>
        </div>
      </div>
    </div>
  );
});

export const ProjectCustomFieldsSettings = observer(() => {
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails } = useProject();

  const [isLoading, setIsLoading] = useState(false);
  const [fields, setFields] = useState<ICustomField[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [newField, setNewField] = useState<Partial<ICustomField>>({
    name: "",
    key: "",
    field_type: "",
    is_required: false,
    options: [],
  });

  useEffect(() => {
    fetchCustomFields();
  }, [projectId, workspaceSlug]);

  const fetchCustomFields = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setFields(data);
      }
    } catch (error) {
      console.error("커스텀 필드 로드 중 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "커스텀 필드를 불러오는데 실패했습니다.",
      });
    }
  };

  const handleCreateOrUpdateField = async () => {
    if (!newField.name || !newField.key) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "필수 필드를 입력해주세요",
        message: "필드명과 식별자는 필수입니다.",
      });
      return;
    }

    // 선택/다중선택 타입의 경우 옵션이 필요
    if ((newField.field_type === "select" || newField.field_type === "multiselect") && (!newField.options || newField.options.length === 0)) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "옵션을 추가해주세요",
        message: "선택 타입의 필드는 최소 하나의 옵션이 필요합니다.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const url = isEditMode && editingFieldId 
        ? `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${editingFieldId}/`
        : `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`;
      
      const method = isEditMode ? "PATCH" : "POST";
      
      const requestData = {
        ...newField,
        options: (newField.field_type === "select" || newField.field_type === "multiselect") 
          ? newField.options?.filter(v => v.trim() !== "") || []
          : undefined,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error("Failed to save custom field");

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: isEditMode ? "커스텀 필드 수정 완료" : "커스텀 필드 생성 완료",
        message: isEditMode ? "커스텀 필드가 수정되었습니다." : "새로운 커스텀 필드가 추가되었습니다.",
      });

      await fetchCustomFields();
      resetForm();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: isEditMode ? "커스텀 필드 수정 실패" : "커스텀 필드 생성 실패",
        message: "커스텀 필드를 저장하는 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewField({
      name: "",
      key: "",
      field_type: "",
      is_required: false,
      options: [],
    });
    setIsEditMode(false);
    setEditingFieldId(null);
  };

  const handleEditField = (field: ICustomField) => {
    setNewField({
      ...field,
      options: field.options || [],
    });
    setIsEditMode(true);
    setEditingFieldId(field.id);
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${fieldId}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        setFields(fields.filter((f) => f.id !== fieldId));
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "커스텀 필드가 삭제되었습니다.",
        });
      }
    } catch (error) {
      console.error("커스텀 필드 삭제 중 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "커스텀 필드 삭제에 실패했습니다.",
      });
    }
  };

  const handleDrop = async (sourceId: string, destinationId: string) => {
    const sourceIndex = fields.findIndex(f => f.id === sourceId);
    const destinationIndex = fields.findIndex(f => f.id === destinationId);
    
    if (sourceIndex === -1 || destinationIndex === -1) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      sort_order: index * 1000,
    }));

    setFields(updatedItems);

    try {
      await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/reorder/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            field_orders: updatedItems.map((item) => ({
              id: item.id,
              sort_order: item.sort_order,
            })),
          }),
        }
      );
    } catch (error) {
      console.error("필드 순서 변경 중 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: "필드 순서 변경에 실패했습니다.",
      });
    }
  };

  const getFieldPlaceholder = (fieldType: string) => {
    switch (fieldType) {
      case "select":
      case "multiselect":
        return "예: 선택 옵션";
      case "date":
        return "예: 2024-03-21";
      case "project_member":
      case "project_members":
        return "예: 담당자";
      default:
        return "";
    }
  };

  const getFieldHelperText = (fieldType: string) => {
    switch (fieldType) {
      case "select":
        return "미리 정의된 옵션 중 하나를 선택할 수 있습니다.";
      case "multiselect":
        return "미리 정의된 옵션 중 여러 개를 선택할 수 있습니다.";
      case "date":
        return "날짜를 선택할 수 있습니다.";
      case "project_member":
        return "프로젝트 멤버 중 한 명을 선택할 수 있습니다.";
      case "project_members":
        return "프로젝트 멤버 중 여러 명을 선택할 수 있습니다.";
      default:
        return "";
    }
  };

  const getKeyPlaceholder = (fieldType: string) => {
    switch (fieldType) {
      case "select":
      case "multiselect":
        return "예: status";
      case "date":
        return "예: due_date";
      case "project_member":
      case "project_members":
        return "예: assignee";
      default:
        return "예: field_key";
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
            <h4 className="text-lg font-medium">
              {isEditMode ? "커스텀 필드 수정" : "새 커스텀 필드 추가"}
            </h4>
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
                placeholder={newField.name ? newField.name.toLowerCase().replace(/\s+/g, "_") : getKeyPlaceholder(newField.field_type || "text")}
                disabled={isEditMode}
              />
              <p className="text-xs text-custom-text-200">{isEditMode ? "식별자는 수정할 수 없습니다" : "시스템에서 사용될 고유 식별자 (영문, 숫자, _ 만 사용)"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-custom-text-300">필드 타입</label>
              <CustomSelect
                value={newField.field_type}
                onChange={(val: string) => setNewField({ ...newField, field_type: val })}
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
          
          <Button
            variant="primary"
            onClick={handleCreateOrUpdateField}
            loading={isLoading}
          >
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