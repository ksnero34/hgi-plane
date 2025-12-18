import { CustomFields } from "@/components/project/settings/custom-fields";

const ProjectCustomFieldsSettingsPage = () => (
  <div className="flex flex-col gap-8">
    <div>
      <h3 className="text-2xl font-semibold">프로젝트 커스텀 필드</h3>
      <p className="text-custom-text-400">이 프로젝트의 이슈에서 사용할 수 있는 커스텀 필드를 관리합니다.</p>
    </div>
    <CustomFields />
  </div>
);

export default ProjectCustomFieldsSettingsPage;
