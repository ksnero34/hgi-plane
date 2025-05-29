import { observer } from "mobx-react";
import { X } from "lucide-react";
// types
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IIssueFilterOptions, IIssueLabel, IState, TCustomField } from "@plane/types";
// components
import { Tag } from "@plane/ui";
import {
  AppliedCycleFilters,
  AppliedDateFilters,
  AppliedLabelsFilters,
  AppliedMembersFilters,
  AppliedModuleFilters,
  AppliedPriorityFilters,
  AppliedProjectFilters,
  AppliedStateFilters,
  AppliedStateGroupFilters,
  AppliedCustomFieldFilters,
} from "@/components/issues";
// constants
// helpers
import { replaceUnderscoreIfSnakeCase } from "@/helpers/string.helper";
// hooks
import { useUserPermissions } from "@/hooks/store";
// plane web components
import { AppliedIssueTypeFilters } from "@/plane-web/components/issues";

type Props = {
  appliedFilters: IIssueFilterOptions;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof IIssueFilterOptions, value: string | null) => void;
  labels?: IIssueLabel[] | undefined;
  states?: IState[] | undefined;
  customFields?: TCustomField[] | undefined;
  alwaysAllowEditing?: boolean;
  disableEditing?: boolean;
  workspaceSlug?: string;
  projectId?: string;
};

const membersFilters = ["assignees", "mentions", "created_by", "subscriber"];
const dateFilters = ["start_date", "target_date"];

export const AppliedFiltersList: React.FC<Props> = observer((props) => {
  const {
    appliedFilters,
    handleClearAllFilters,
    handleRemoveFilter,
    labels,
    states,
    customFields,
    alwaysAllowEditing,
    disableEditing = false,
    workspaceSlug,
    projectId,
  } = props;
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  if (!appliedFilters) return null;

  if (Object.keys(appliedFilters).length === 0) return null;

  const isEditingAllowed =
    !disableEditing &&
    (alwaysAllowEditing ||
      allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT));

  // 필터 키에 따라 한글 이름을 반환하는 함수
  const getFilterKeyLabel = (key: keyof IIssueFilterOptions) => {
    const filterLabels: Record<string, string> = {
      assignees: "담당자",
      mentions: "멘션",
      created_by: "생성자",
      subscriber: "구독자",
      start_date: "시작일",
      target_date: "마감일",
      labels: "레이블",
      priority: "우선순위",
      state: "상태",
      state_group: "상태 그룹",
      project: "프로젝트",
      cycle: "주기",
      module: "모듈",
      issue_type: "작업 항목 유형",
      team_project: "팀 프로젝트",
      custom_fields: "커스텀 필드"
    };

    return filterLabels[key] || replaceUnderscoreIfSnakeCase(key);
  };

  return (
    <div className="flex flex-wrap items-stretch gap-2 bg-custom-background-100 truncate my-auto">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof IIssueFilterOptions;

        if (!value) return;
        if (Array.isArray(value) && value.length === 0) return;

        // 커스텀 필드의 경우 별도 처리
        if (filterKey === "custom_fields" && customFields) {
          const customFieldFilters = typeof value === 'string' ? JSON.parse(value) : value as { [field_id: string]: string[] };
          
          return Object.entries(customFieldFilters).map(([fieldId, fieldValues]) => {
            if (!fieldValues || fieldValues.length === 0) return null;
            
            const field = customFields.find(f => f.id === fieldId);
            if (!field) return null;
            
            return (
              <Tag key={`${filterKey}-${fieldId}`}>
                <span className="text-xs text-custom-text-300">{field.name}</span>
                <div className="flex flex-wrap items-center gap-1">
                  <AppliedCustomFieldFilters
                    appliedFilters={{ [fieldId]: fieldValues }}
                    customFields={customFields}
                    editable={isEditingAllowed}
                    handleRemove={(fieldId, val) => {
                      // 커스텀 필드 필터 제거 로직
                      const currentCustomFieldFilters = typeof appliedFilters.custom_fields === 'string' 
                        ? JSON.parse(appliedFilters.custom_fields) 
                        : appliedFilters.custom_fields || {};
                      const currentFieldValues = currentCustomFieldFilters[fieldId] || [];
                      const newFieldValues = currentFieldValues.filter(v => v !== val);
                      
                      const newCustomFieldFilters = {
                        ...currentCustomFieldFilters,
                        [fieldId]: newFieldValues.length > 0 ? newFieldValues : undefined
                      };
                      
                      // 빈 배열인 필드들 제거
                      Object.keys(newCustomFieldFilters).forEach(key => {
                        if (!newCustomFieldFilters[key] || newCustomFieldFilters[key].length === 0) {
                          delete newCustomFieldFilters[key];
                        }
                      });
                      
                      const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
                        ? JSON.stringify(newCustomFieldFilters) 
                        : null;
                      
                      handleRemoveFilter("custom_fields", customFieldsValue);
                    }}
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                  />
                </div>
                {isEditingAllowed && (
                  <button
                    type="button"
                    className="grid place-items-center text-custom-text-300 hover:text-custom-text-200"
                    onClick={() => {
                      // 특정 필드의 모든 값 제거
                      const currentCustomFieldFilters = typeof appliedFilters.custom_fields === 'string' 
                        ? JSON.parse(appliedFilters.custom_fields) 
                        : appliedFilters.custom_fields || {};
                      
                      const newCustomFieldFilters = { ...currentCustomFieldFilters };
                      delete newCustomFieldFilters[fieldId];
                      
                      const customFieldsValue = Object.keys(newCustomFieldFilters).length > 0 
                        ? JSON.stringify(newCustomFieldFilters) 
                        : null;
                      
                      handleRemoveFilter("custom_fields", customFieldsValue);
                    }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </Tag>
            );
          }).filter(Boolean);
        }

        return (
          <Tag key={filterKey}>
            <span className="text-xs text-custom-text-300">{getFilterKeyLabel(filterKey)}</span>
            {membersFilters.includes(filterKey) && (
              <AppliedMembersFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter(filterKey, val)}
                values={value}
              />
            )}
            {dateFilters.includes(filterKey) && (
              <AppliedDateFilters handleRemove={(val) => handleRemoveFilter(filterKey, val)} values={value} />
            )}
            {filterKey === "labels" && (
              <AppliedLabelsFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("labels", val)}
                labels={labels}
                values={value}
              />
            )}
            {filterKey === "priority" && (
              <AppliedPriorityFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("priority", val)}
                values={value}
              />
            )}
            {filterKey === "state" && states && (
              <AppliedStateFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("state", val)}
                states={states}
                values={value}
              />
            )}
            {filterKey === "state_group" && (
              <AppliedStateGroupFilters handleRemove={(val) => handleRemoveFilter("state_group", val)} values={value} />
            )}
            {filterKey === "project" && (
              <AppliedProjectFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("project", val)}
                values={value}
              />
            )}
            {filterKey === "cycle" && (
              <AppliedCycleFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("cycle", val)}
                values={value}
              />
            )}
            {filterKey === "module" && (
              <AppliedModuleFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("module", val)}
                values={value}
              />
            )}
            {filterKey === "issue_type" && (
              <AppliedIssueTypeFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("issue_type", val)}
                values={value}
              />
            )}
            {filterKey === "team_project" && (
              <AppliedProjectFilters
                editable={isEditingAllowed}
                handleRemove={(val) => handleRemoveFilter("team_project", val)}
                values={value}
              />
            )}
          </Tag>
        );
      })}
      {isEditingAllowed && (
        <button type="button" onClick={handleClearAllFilters}>
          <Tag>
            {t("common.clear_all")}
            <X size={12} strokeWidth={2} />
          </Tag>
        </button>
      )}
    </div>
  );
});
