import { ProjectNotificationSettings } from "@/components/project/settings/notifications";

const ProjectNotificationsSettingsPage = () => (
  <div className="flex flex-col gap-8">
    <div>
      <h3 className="text-2xl font-semibold">프로젝트 알림 설정</h3>
      <p className="text-custom-text-400">이 프로젝트의 알림 설정을 관리합니다.</p>
    </div>
    <ProjectNotificationSettings />
  </div>
);

export default ProjectNotificationsSettingsPage;
