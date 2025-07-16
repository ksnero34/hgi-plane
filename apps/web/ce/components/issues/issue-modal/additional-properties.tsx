import { useFormContext, Controller } from "react-hook-form";
import { Tag, CalendarCheck2, MessageSquare, Users, UserCircle2 } from "lucide-react";
import { Input } from "@plane/ui";
import { useProjectCustomFields } from "@/hooks/store/use-project-custom-fields";
import { DateDropdown, MemberDropdown, CustomFieldDropdown } from "@/components/dropdowns";

type TIssueAdditionalPropertiesProps = {
  issueId: string | undefined;
  issueTypeId: string | null;
  projectId: string;
  workspaceSlug: string;
  isDraft?: boolean;
};

export const IssueAdditionalProperties: React.FC<TIssueAdditionalPropertiesProps> = ({ issueTypeId, projectId, workspaceSlug }) => {
  const { watch, control } = useFormContext();
  const { customFields } = useProjectCustomFields(workspaceSlug, projectId);

  // console.log("IssueAdditionalProperties - issueTypeId:", issueTypeId);
  // console.log("IssueAdditionalProperties - customFields:", customFields);

  const filteredCustomFields = issueTypeId ? customFields.filter(field => 
    field.issue_type === issueTypeId
  ) : [];

  // console.log("IssueAdditionalProperties - filteredCustomFields:", filteredCustomFields);

  if (!filteredCustomFields.length) return null;

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "text":
        return MessageSquare;
      case "date":
        return CalendarCheck2;
      case "select":
      case "multiselect":
        return Tag;
      case "project_member":
        return UserCircle2;
      case "project_members":
        return Users;
      default:
        return MessageSquare;
    }
  };

  return (
    <div className="space-y-3">
      {filteredCustomFields.map(field => {
        const FieldIcon = getFieldIcon(field.field_type);
        
        return (
          <div key={field.id} className="flex w-full items-center gap-3 h-8">
            <div className="flex items-center gap-1 w-1/4 flex-shrink-0 text-sm text-custom-text-300">
              <FieldIcon className="h-4 w-4 flex-shrink-0" />
              <span>{field.name}</span>
            </div>
            <div className="h-full w-3/4 flex-grow">
              <Controller
                name={`custom_field_values.${field.id}.value`}
                control={control}
                render={({ field: { onChange, value } }) => {
                  switch (field.field_type) {
                    case "text":
                      return (
                        <input
                          type="text"
                          value={value || ""}
                          onChange={onChange}
                          placeholder={field.placeholder || field.name}
                          className="w-full px-2 py-0.5 text-sm bg-transparent border border-custom-border-200 rounded focus:outline-none focus:border-custom-primary-100 text-custom-text-200 placeholder:text-custom-text-400"
                        />
                      );
                    case "select":
                      return (
                        <CustomFieldDropdown
                          field={field}
                          value={value}
                          onChange={onChange}
                          buttonVariant="transparent-with-text"
                          className="w-full group"
                          buttonContainerClassName="w-full text-left"
                          buttonClassName={`text-sm ${value ? "" : "text-custom-text-400"}`}
                          dropdownArrow
                          dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                          placeholder={field.name}
                          showFieldNameWhenEmpty={true}
                          hideIconWhenEmpty={true}
                        />
                      );
                    case "multiselect":
                      return (
                        <CustomFieldDropdown
                          field={field}
                          value={value}
                          onChange={onChange}
                          buttonVariant="transparent-with-text"
                          className="w-full group"
                          buttonContainerClassName="w-full text-left"
                          buttonClassName={`text-sm ${value && value.length > 0 ? "" : "text-custom-text-400"}`}
                          dropdownArrow
                          dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                          placeholder={field.name}
                          showFieldNameWhenEmpty={true}
                          hideIconWhenEmpty={true}
                        />
                      );
                    case "date":
                      return (
                        <DateDropdown
                          value={value}
                          onChange={onChange}
                          placeholder="날짜 선택"
                          buttonVariant="transparent-with-text"
                          className="w-full group"
                          buttonContainerClassName="w-full text-left"
                          buttonClassName={`text-sm ${value ? "" : "text-custom-text-400"}`}
                          hideIcon
                          clearIconClassName="h-3 w-3 hidden group-hover:inline"
                        />
                      );
                    case "project_member":
                      return (
                        <MemberDropdown
                          value={value}
                          onChange={onChange}
                          projectId={projectId}
                          placeholder={`${field.name} 선택`}
                          buttonVariant="transparent-with-text"
                          className="w-full group"
                          buttonContainerClassName="w-full text-left"
                          buttonClassName={`text-sm ${value ? "" : "text-custom-text-400"}`}
                          hideIcon={!value}
                          dropdownArrow
                          dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                          showUserDetails={true}
                          multiple={false}
                        />
                      );
                    case "project_members":
                      return (
                        <MemberDropdown
                          value={value}
                          onChange={onChange}
                          projectId={projectId}
                          placeholder={`${field.name} 선택`}
                          multiple
                          buttonVariant="transparent-with-text"
                          className="w-full group"
                          buttonContainerClassName="w-full text-left"
                          buttonClassName={`text-sm ${value && value.length > 0 ? "" : "text-custom-text-400"}`}
                          hideIcon={!value || value.length === 0}
                          dropdownArrow
                          dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                          showUserDetails={true}
                        />
                      );
                    default:
                      return (
                        <div className="w-full h-full flex items-center gap-1.5 rounded px-2 py-0.5 text-sm justify-between cursor-not-allowed">
                          <span className="flex-grow truncate text-xs leading-5 text-custom-text-400">
                            지원하지 않는 필드 타입
                          </span>
                        </div>
                      );
                  }
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
