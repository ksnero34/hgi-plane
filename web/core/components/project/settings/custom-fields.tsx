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
  { value: "text", label: "텍스트", description: "일반 텍스트를 입력할 수 있습니다." },
  { value: "number", label: "숫자", description: "숫자만 입력할 수 있습니다." },
  { value: "date", label: "날짜", description: "날짜를 선택할 수 있습니다." },
  { value: "select", label: "선택", description: "미리 정의된 옵션 중 하나를 선택할 수 있습니다." },
  { value: "multiselect", label: "다중선택", description: "미리 정의된 옵션 중 여러 개를 선택할 수 있습니다." },
  { value: "date", label: "날짜", description: "날짜를 선택할 수 있습니다." },
  { value: "project_member", label: "프로젝트 멤버", description: "프로젝트 멤버 중 한 명을 선택할 수 있습니다." },
  { value: "project_members", label: "프로젝트 멤버(다중)", description: "프로젝트 멤버 중 여러 명을 선택할 수 있습니다." },
];

const CustomFieldItem = observer(({ field, index, onDelete }: { field: ICustomField; index: number; onDelete: (id: string) => void }) => {
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
        <div className="col-span-3">
          <div className="text-sm text-custom-text-200">식별자</div>
          <div className="font-medium">{field.key}</div>
        </div>
        <div className="col-span-3">
          <div className="text-sm text-custom-text-200">필드 타입</div>
          <div className="font-medium">{FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}</div>
        </div>
        <div className="col-span-2">
          <div className="text-sm text-custom-text-200">사전 정의된 값</div>
          <div className="font-medium">{field.settings?.predefined_values?.length || 0}개</div>
        </div>
        <div className="col-span-1 flex justify-end">
          <Button variant="danger" onClick={() => onDelete(field.id)}>삭제</Button>
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
  const [newField, setNewField] = useState<Partial<ICustomField>>({
    name: "",
    key: "",
    field_type: "",
    is_required: false,
    settings: {
      predefined_values: [],
    },
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

  const handleCreateField = async () => {
    if (!newField.name || !newField.key) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "필수 필드를 입력해주세요",
        message: "필드명과 식별자는 필수입니다.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...newField,
            settings: {
              ...newField.settings,
              predefined_values: newField.settings?.predefined_values?.filter(v => v.trim() !== "") || [],
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create custom field");

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "커스텀 필드 생성 완료",
        message: "새로운 커스텀 필드가 추가되었습니다.",
      });

      await fetchCustomFields();
      setNewField({
        name: "",
        key: "",
        field_type: "",
        is_required: false,
        settings: {
          predefined_values: [],
        },
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "커스텀 필드 생성 실패",
        message: "커스텀 필드를 생성하는 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
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
      case "text":
        return "예: 고객사 이름";
      case "number":
        return "예: 1234";
      case "date":
        return "예: 2024-03-21";
      case "select":
      case "multiselect":
        return "예: 선택 옵션";
      case "url":
        return "예: https://example.com";
      case "email":
        return "예: user@example.com";
      case "project_member":
      case "project_members":
        return "예: 담당자";
      default:
        return "";
    }
  };

  const getFieldHelperText = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return "일반 텍스트를 입력할 수 있습니다.";
      case "number":
        return "숫자만 입력할 수 있습니다.";
      case "date":
        return "날짜를 선택할 수 있습니다.";
      case "select":
        return "미리 정의된 옵션 중 하나를 선택할 수 있습니다.";
      case "multiselect":
        return "미리 정의된 옵션 중 여러 개를 선택할 수 있습니다.";
      case "url":
        return "웹 주소를 입력할 수 있습니다.";
      case "email":
        return "이메일 주소를 입력할 수 있습니다.";
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
      case "text":
        return "예: customer_name";
      case "number":
        return "예: amount";
      case "date":
        return "예: due_date";
      case "select":
      case "multiselect":
        return "예: status";
      case "url":
        return "예: website_url";
      case "email":
        return "예: contact_email";
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="필드 이름"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              placeholder={getFieldPlaceholder(newField.field_type || "text")}
              helperText={getFieldHelperText(newField.field_type || "text")}
            />
            <Input
              label="고유 식별자"
              value={newField.key}
              onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              placeholder={newField.name ? newField.name.toLowerCase().replace(/\s+/g, "_") : getKeyPlaceholder(newField.field_type || "text")}
              helperText="시스템에서 사용될 고유 식별자 (영문, 숫자, _ 만 사용)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect
              label="필드 타입"
              value={newField.field_type}
              onChange={(val) => setNewField({ ...newField, field_type: val })}
              buttonClassName="w-full text-left"
              label={FIELD_TYPES.find(t => t.value === newField.field_type)?.label || "필드 타입 선택"}
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
            <div className="flex items-center">
              <ToggleSwitch
                value={newField.is_required}
                onChange={(val) => setNewField({ ...newField, is_required: val })}
              />
              <span className="ml-2">필수 필드</span>
            </div>
          </div>
          {(newField.field_type === "text" || newField.field_type === "email" || newField.field_type === "url" || newField.field_type === "number") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">사전 정의된 값</label>
              <div className="flex flex-wrap gap-2">
                {newField.settings?.predefined_values?.map((value, index) => (
                  <div key={index} className="flex items-center gap-1 bg-custom-background-80 rounded px-2 py-1">
                    <span className="text-sm">{value}</span>
                    <button
                      className="text-custom-text-200 hover:text-custom-text-100"
                      onClick={() => {
                        const newValues = [...(newField.settings?.predefined_values || [])];
                        newValues.splice(index, 1);
                        setNewField({
                          ...newField,
                          settings: {
                            ...newField.settings,
                            predefined_values: newValues,
                          },
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <Input
                  type={newField.field_type === "number" ? "number" : "text"}
                  placeholder="새 값 추가"
                  className="w-32"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
                      setNewField({
                        ...newField,
                        settings: {
                          ...newField.settings,
                          predefined_values: [...(newField.settings?.predefined_values || []), e.currentTarget.value.trim()],
                        },
                      });
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              <p className="text-xs text-custom-text-200">Enter 키를 눌러 값을 추가하세요</p>
            </div>
          )}
          <Button
            variant="primary"
            onClick={handleCreateField}
            loading={isLoading}
          >
            필드 추가
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}); 