import { useState, Fragment } from "react";
import { Button, Input, CustomSelect } from "@plane/ui";
import { Dialog, Transition } from "@headlessui/react";
import type { INotificationTemplate } from "../page";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<INotificationTemplate>) => Promise<void>;
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    service_type: "custom",
    endpoint_url: "",
    method: "POST",
    headers: '{\n  "Content-Type": "application/json"\n}',
    json_template: '{\n  "message": "{{message}}",\n  "user": "{{user_email}}"\n}',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceTypes = [
    { value: "slack", label: "Slack" },
    { value: "discord", label: "Discord" },
    { value: "teams", label: "Microsoft Teams" },
    { value: "webhook", label: "Generic Webhook" },
    { value: "custom", label: "Custom API" },
  ];

  const handleServiceTypeChange = (serviceType: string) => {
    setFormData((prev) => ({ ...prev, service_type: serviceType }));

    // 서비스 타입별 기본 템플릿 설정
    switch (serviceType) {
      case "slack":
        setFormData((prev) => ({
          ...prev,
          json_template: JSON.stringify(
            {
              text: "{{title}}",
              attachments: [
                {
                  color: "good",
                  fields: [
                    { title: "User", value: "{{user_email}}", short: true },
                    { title: "Issue", value: "{{issue_name}}", short: true },
                    { title: "Message", value: "{{message}}", short: false },
                  ],
                },
              ],
            },
            null,
            2
          ),
        }));
        break;
      case "discord":
        setFormData((prev) => ({
          ...prev,
          json_template: JSON.stringify(
            {
              username: "Plane Notifications",
              embeds: [
                {
                  title: "{{title}}",
                  description: "{{message}}",
                  color: 3447003,
                  fields: [
                    { name: "User", value: "{{user_email}}", inline: true },
                    { name: "Issue", value: "{{issue_name}}", inline: true },
                    { name: "Project", value: "{{project_name}}", inline: true },
                  ],
                },
              ],
            },
            null,
            2
          ),
        }));
        break;
      case "teams":
        setFormData((prev) => ({
          ...prev,
          json_template: JSON.stringify(
            {
              "@type": "MessageCard",
              "@context": "https://schema.org/extensions",
              summary: "{{title}}",
              themeColor: "0072C6",
              title: "{{title}}",
              text: "{{message}}",
              sections: [
                {
                  activityTitle: "Plane Notification",
                  activitySubtitle: "{{workspace_name}}",
                  facts: [
                    { name: "User:", value: "{{user_email}}" },
                    { name: "Issue:", value: "{{issue_name}}" },
                    { name: "Project:", value: "{{project_name}}" },
                  ],
                },
              ],
            },
            null,
            2
          ),
        }));
        break;
      default:
        setFormData((prev) => ({
          ...prev,
          json_template: JSON.stringify(
            {
              message: "{{message}}",
              user: "{{user_email}}",
              issue: "{{issue_name}}",
              workspace: "{{workspace_name}}",
            },
            null,
            2
          ),
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // JSON 파싱 검증
      const headers = JSON.parse(formData.headers);
      const json_template = JSON.parse(formData.json_template);

      await onSubmit({
        name: formData.name,
        description: formData.description,
        service_type: formData.service_type,
        endpoint_url: formData.endpoint_url,
        method: formData.method,
        headers,
        json_template,
      });

      onClose();
    } catch (error) {
      console.error("템플릿 생성 오류:", error);
      alert("JSON 형식을 확인해주세요.");
    } finally {
      setIsSubmitting(false);
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
                  <h2 className="text-xl font-medium text-custom-text-100 mb-6">새 템플릿 추가</h2>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 기본 정보 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">템플릿 이름 *</label>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="예: 내 Slack 템플릿"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">설명</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        placeholder="템플릿에 대한 간단한 설명"
                        className="w-full px-3 py-2 border border-custom-border-200 rounded-md bg-custom-background-100 text-custom-text-100 placeholder:text-custom-text-400 focus:outline-none focus:ring-2 focus:ring-custom-primary-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">서비스 타입 *</label>
                      <CustomSelect
                        value={serviceTypes.find((t) => t.value === formData.service_type)}
                        label={serviceTypes.find((t) => t.value === formData.service_type)?.label || ""}
                        onChange={(option: any) => handleServiceTypeChange(option.value)}
                        input
                      >
                        {serviceTypes.map((type) => (
                          <CustomSelect.Option key={type.value} value={type}>
                            {type.label}
                          </CustomSelect.Option>
                        ))}
                      </CustomSelect>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">
                        엔드포인트 URL (선택사항)
                      </label>
                      <Input
                        type="url"
                        value={formData.endpoint_url}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endpoint_url: e.target.value }))}
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">HTTP 메소드</label>
                      <CustomSelect
                        value={{ value: formData.method, label: formData.method }}
                        label={formData.method}
                        onChange={(option: any) => setFormData((prev) => ({ ...prev, method: option.value }))}
                        input
                      >
                        <CustomSelect.Option value={{ value: "POST", label: "POST" }}>POST</CustomSelect.Option>
                        <CustomSelect.Option value={{ value: "PUT", label: "PUT" }}>PUT</CustomSelect.Option>
                        <CustomSelect.Option value={{ value: "PATCH", label: "PATCH" }}>PATCH</CustomSelect.Option>
                      </CustomSelect>
                    </div>

                    {/* 헤더 설정 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">HTTP 헤더 (JSON)</label>
                      <textarea
                        value={formData.headers}
                        onChange={(e) => setFormData((prev) => ({ ...prev, headers: e.target.value }))}
                        rows={4}
                        placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer your-token"\n}'
                        className="w-full px-3 py-2 border border-custom-border-200 rounded-md bg-custom-background-100 text-custom-text-100 placeholder:text-custom-text-400 focus:outline-none focus:ring-2 focus:ring-custom-primary-100 font-mono text-sm"
                      />
                    </div>

                    {/* JSON 템플릿 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">JSON 템플릿</label>
                      <textarea
                        value={formData.json_template}
                        onChange={(e) => setFormData((prev) => ({ ...prev, json_template: e.target.value }))}
                        rows={8}
                        placeholder='{\n  "text": "{{message}}",\n  "user": "{{user_email}}",\n  "issue": "{{issue_name}}"\n}'
                        className="w-full px-3 py-2 border border-custom-border-200 rounded-md bg-custom-background-100 text-custom-text-100 placeholder:text-custom-text-400 focus:outline-none focus:ring-2 focus:ring-custom-primary-100 font-mono text-sm"
                      />
                      <p className="text-xs text-custom-text-400 mt-1">
                        사용 가능한 변수: {"{{user_id}}"}, {"{{user_email}}"}, {"{{title}}"}, {"{{message}}"},{" "}
                        {"{{issue_name}}"}, {"{{workspace_name}}"}, {"{{project_name}}"} 등
                      </p>
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="neutral-primary" size="sm" onClick={onClose}>
                        취소
                      </Button>
                      <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
                        {isSubmitting ? "생성 중..." : "생성"}
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
