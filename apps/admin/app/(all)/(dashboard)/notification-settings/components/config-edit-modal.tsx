import { useState, Fragment } from "react";
import { Button, Input, CustomSelect } from "@plane/ui";
import { Dialog, Transition } from "@headlessui/react";
import type { INotificationConfig } from "../page";

interface ConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: INotificationConfig;
  onSubmit: (data: Partial<INotificationConfig>) => Promise<void>;
}

export const ConfigEditModal: React.FC<ConfigEditModalProps> = ({ isOpen, onClose, config, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: config.name,
    endpoint_url: config.endpoint_url,
    method: config.method,
    headers: JSON.stringify(config.headers, null, 2),
    json_template: JSON.stringify(config.json_template, null, 2),
    timeout: config.timeout,
    retry_count: config.retry_count,
    is_enabled: config.is_enabled,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // JSON 파싱 검증
      const headers = JSON.parse(formData.headers);
      const json_template = JSON.parse(formData.json_template);

      await onSubmit({
        name: formData.name,
        endpoint_url: formData.endpoint_url,
        method: formData.method,
        headers,
        json_template,
        timeout: formData.timeout,
        retry_count: formData.retry_count,
        is_enabled: formData.is_enabled,
      });

      onClose();
    } catch (error) {
      console.error("설정 업데이트 오류:", error);
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
                  <h2 className="text-xl font-medium text-custom-text-100 mb-6">알림 설정 편집</h2>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 기본 정보 */}
                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">설정 이름 *</label>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="예: Slack 알림 설정"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">엔드포인트 URL *</label>
                      <Input
                        type="url"
                        value={formData.endpoint_url}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endpoint_url: e.target.value }))}
                        placeholder="https://hooks.slack.com/services/..."
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                      <div>
                        <label className="block text-sm font-medium text-custom-text-200 mb-2">타임아웃 (초)</label>
                        <Input
                          type="number"
                          value={formData.timeout}
                          onChange={(e) => setFormData((prev) => ({ ...prev, timeout: parseInt(e.target.value) }))}
                          min="1"
                          max="300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-custom-text-200 mb-2">재시도 횟수</label>
                      <Input
                        type="number"
                        value={formData.retry_count}
                        onChange={(e) => setFormData((prev) => ({ ...prev, retry_count: parseInt(e.target.value) }))}
                        min="0"
                        max="10"
                      />
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

                    {/* 활성화 여부 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_enabled"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData((prev) => ({ ...prev, is_enabled: e.target.checked }))}
                        className="rounded border-custom-border-200"
                      />
                      <label htmlFor="is_enabled" className="text-sm text-custom-text-200">
                        설정 활성화
                      </label>
                    </div>

                    {/* 버튼 */}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="neutral-primary" size="sm" onClick={onClose}>
                        취소
                      </Button>
                      <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
                        {isSubmitting ? "저장 중..." : "저장"}
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
