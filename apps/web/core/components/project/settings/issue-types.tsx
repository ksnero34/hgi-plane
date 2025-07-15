"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, Input, TOAST_TYPE, setToast, CustomEmojiIconPicker, EmojiIconPickerTypes } from "@plane/ui";
import { IIssueType } from "@plane/types";
import { useIssueType } from "@/hooks/store/use-issue-type";
import { Logo } from "@/components/common";
import { convertHexEmojiToDecimal } from "@plane/utils";
import { getRandomEmoji } from "@/helpers/emoji.helper";

const getDefaultLogoProp = () => ({
  in_use: "emoji" as const,
  emoji: {
    value: getRandomEmoji(),
  },
});

const IssueTypeItem: React.FC<{ 
  issueType: IIssueType;
  onEdit: (issueType: IIssueType) => void;
  onDelete: (issueTypeId: string) => void;
}> = ({ issueType, onEdit, onDelete }) => {
  return (
    <div className="group flex items-center justify-between rounded-lg border border-custom-border-200 bg-custom-background-100 p-4 hover:bg-custom-background-90 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-custom-border-200">
          <Logo logo={issueType.logo_props || { in_use: "emoji", emoji: { value: "128204" } }} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-custom-text-100 truncate">{issueType.name || "제목 없음"}</h4>
          </div>
          {issueType.description && (
            <p className="text-sm text-custom-text-300 truncate mt-1">{issueType.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="neutral-primary" 
          size="sm" 
          onClick={() => onEdit(issueType)}
          className="text-xs"
        >
          수정
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          onClick={() => onDelete(issueType.id)}
          className="text-xs"
        >
          삭제
        </Button>
      </div>
    </div>
  );
};

export const IssueTypes: React.FC = observer(() => {
  const { projectId } = useParams();
  const { issueTypes, createIssueType, updateIssueType, deleteIssueType } = useIssueType(projectId as string);

  const [newIssueType, setNewIssueType] = useState<Partial<IIssueType>>(() => ({ 
    logo_props: getDefaultLogoProp() 
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

  const handleEdit = (issueType: IIssueType) => {
    setNewIssueType(issueType);
    setIsEditMode(true);
    setIsIconPickerOpen(false);
  };

  const handleDelete = async (issueTypeId: string) => {
    if (!confirm("이 이슈 타입을 삭제하시겠습니까?")) {
      return;
    }
    
    try {
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
        <Button 
          variant="primary" 
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
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
                <CustomEmojiIconPicker
                  closeOnSelect={false}
                  isOpen={isIconPickerOpen}
                  handleToggle={(val: boolean) => setIsIconPickerOpen(val)}
                  className="flex items-center justify-center"
                  buttonClassName="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-custom-border-200 hover:bg-custom-background-90 transition-colors"
                  label={<Logo logo={newIssueType.logo_props || { in_use: "emoji", emoji: { value: "128204" } }} size={20} />}
                  onChange={(val) => {
                    let logoValue = {};
                    if (val?.type === "emoji")
                      logoValue = {
                        value: convertHexEmojiToDecimal(val.value.unified),
                      };
                    else if (val?.type === "icon") logoValue = val.value;
                    
                    setNewIssueType({
                      ...newIssueType,
                      logo_props: {
                        in_use: val?.type,
                        [val?.type]: logoValue,
                      },
                    });
                    setIsIconPickerOpen(false);
                  }}
                  defaultIconColor={newIssueType.logo_props?.in_use === "icon" ? newIssueType.logo_props?.icon?.color : undefined}
                  defaultOpen={
                    newIssueType.logo_props?.in_use === "emoji" 
                      ? EmojiIconPickerTypes.EMOJI 
                      : EmojiIconPickerTypes.ICON
                  }
                />
                <div className="text-sm text-custom-text-400">
                  이슈 타입을 구분할 수 있는 아이콘을 선택하세요
                </div>
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
              issueType={issueType}
              onDelete={handleDelete}
              onEdit={(issueType) => {
                setNewIssueType(issueType);
                setIsEditMode(true);
                setShowCreateForm(true);
              }}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-custom-text-400">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-custom-text-300">이슈 타입이 없습니다</h3>
            <p className="mt-1 text-sm text-custom-text-400">새 이슈 타입을 추가해서 프로젝트를 체계적으로 관리하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
});
