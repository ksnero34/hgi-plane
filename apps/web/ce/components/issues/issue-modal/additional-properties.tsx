import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@plane/ui";
import { useProjectCustomFields } from "@/hooks/store/use-project-custom-fields";

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

  const filteredCustomFields = customFields.filter(field => 
    field.issue_type === null || field.issue_type === issueTypeId
  );

  if (!filteredCustomFields.length) return null;

  return (
    <div className="space-y-3">
      {filteredCustomFields.map(field => (
        <div key={field.id} className="space-y-1">
          <label className="text-sm font-medium text-custom-text-300">{field.name}</label>
          <Controller
            name={`custom_field_values.${field.id}.value`}
            control={control}
            render={({ field: { onChange, value } }) => {
              switch (field.field_type) {
                case "text":
                  return (
                    <Input
                      type="text"
                      value={value || ""}
                      onChange={onChange}
                      placeholder={field.placeholder || ""}
                      className="w-full"
                    />
                  );
                case "select":
                  return (
                    <select
                      value={value || ""}
                      onChange={onChange}
                      className="w-full px-3 py-2 text-sm border border-custom-border-200 rounded-md bg-transparent text-custom-text-200 focus:outline-none focus:border-custom-primary-100"
                    >
                      <option value="">선택하세요</option>
                      {field.options?.map((option: string) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  );
                case "multiselect":
                  return (
                    <select
                      multiple
                      value={value || []}
                      onChange={(e) => onChange(Array.from(e.target.selectedOptions, option => option.value))}
                      className="w-full px-3 py-2 text-sm border border-custom-border-200 rounded-md bg-transparent text-custom-text-200 focus:outline-none focus:border-custom-primary-100"
                    >
                      {field.options?.map((option: string) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  );
                case "date":
                  return (
                    <Input
                      type="date"
                      value={value || ""}
                      onChange={onChange}
                      className="w-full"
                    />
                  );
                // TODO: Add project_member, project_members types
                default:
                  return null;
              }
            }}
          />
        </div>
      ))}
    </div>
  );
};
