import { useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, Input } from "@plane/ui";
import type { INotificationConfig } from "../page";

interface TestNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: INotificationConfig;
  onTest: (configId: string) => Promise<void>;
}

export const TestNotificationModal: React.FC<TestNotificationModalProps> = ({ isOpen, onClose, config, onTest }) => {
  const [testData, setTestData] = useState({
    user_id: "test_user",
    user_email: "test@example.com",
    title: "테스트 알림",
    message: "이것은 테스트 알림입니다.",
    issue_id: "TEST-001",
    issue_name: "테스트 이슈",
    workspace_name: config.workspace.name,
    project_name: "테스트 프로젝트",
    actor_name: "테스트 사용자",
    notification_type: "test",
    entity_type: "issue",
    entity_id: "test-entity-id",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onTest(config.id);
      onClose();
    } catch (error) {
      console.error("테스트 알림 전송 오류:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 템플릿 미리보기 생성
  const getTemplatePreview = () => {
    try {
      const template = JSON.stringify(config.json_template, null, 2);
      let preview = template;

      // 변수 치환
      Object.entries(testData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, "g");
        preview = preview.replace(regex, value.toString());
      });

      return preview;
    } catch {
      return "템플릿 미리보기 생성 오류";
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-custom-backdrop transition-opacity" />
        </Transition.Child>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-custom-background-100 text-left shadow-custom-shadow-md transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <div className="p-6">
                  <h2 className="text-xl font-medium text-custom-text-100 mb-6">알림 테스트</h2>

                  <div className="space-y-4 mb-6">
                    <div className="bg-custom-background-80 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-custom-text-200 mb-2">설정 정보</h3>
                      <div className="text-xs text-custom-text-400 space-y-1">
                        <p>
                          <strong>이름:</strong> {config.name}
                        </p>
                        <p>
                          <strong>엔드포인트:</strong> {config.endpoint_url}
                        </p>
                        <p>
                          <strong>메소드:</strong> {config.method}
                        </p>
                        <p>
                          <strong>상태:</strong> {config.is_enabled ? "활성화" : "비활성화"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 테스트 데이터 편집 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">테스트 데이터 편집</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">사용자 ID</label>
                          <Input
                            type="text"
                            value={testData.user_id}
                            onChange={(e) => setTestData((prev) => ({ ...prev, user_id: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">사용자 이메일</label>
                          <Input
                            type="email"
                            value={testData.user_email}
                            onChange={(e) => setTestData((prev) => ({ ...prev, user_email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">제목</label>
                          <Input
                            type="text"
                            value={testData.title}
                            onChange={(e) => setTestData((prev) => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">이슈 ID</label>
                          <Input
                            type="text"
                            value={testData.issue_id}
                            onChange={(e) => setTestData((prev) => ({ ...prev, issue_id: e.target.value }))}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-custom-text-400 mb-1">메시지</label>
                          <textarea
                            value={testData.message}
                            onChange={(e) => setTestData((prev) => ({ ...prev, message: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-custom-border-200 rounded-md bg-custom-background-100 text-custom-text-100 placeholder:text-custom-text-400 focus:outline-none focus:ring-2 focus:ring-custom-primary-100 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">이슈 이름</label>
                          <Input
                            type="text"
                            value={testData.issue_name}
                            onChange={(e) => setTestData((prev) => ({ ...prev, issue_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-custom-text-400 mb-1">프로젝트 이름</label>
                          <Input
                            type="text"
                            value={testData.project_name}
                            onChange={(e) => setTestData((prev) => ({ ...prev, project_name: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 템플릿 미리보기 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">
                        전송될 JSON 미리보기
                      </label>
                      <div className="bg-custom-background-80 p-4 rounded-lg">
                        <pre className="text-xs text-custom-text-100 font-mono overflow-x-auto">
                          {getTemplatePreview()}
                        </pre>
                      </div>
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="neutral-primary" size="sm" onClick={onClose}>
                        취소
                      </Button>
                      <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
                        {isSubmitting ? "전송 중..." : "테스트 전송"}
                      </Button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
