"use client";

import { useState } from "react";
import { Button, Modal, Input, Select, TextArea } from "@plane/ui";
import { INotificationConfig, INotificationTemplate, IWorkspace } from "../page";

interface CreateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<INotificationConfig>) => Promise<void>;
  templates: INotificationTemplate[];
  workspaces: IWorkspace[];
  selectedWorkspace: string;
}

export const CreateConfigModal: React.FC<CreateConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  templates,
  workspaces,
  selectedWorkspace,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    endpoint_url: "",
    method: "POST",
    headers: "{\n  \"Content-Type\": \"application/json\"\n}",
    json_template: "{\n  \"message\": \"{{message}}\",\n  \"user\": \"{{user_email}}\"\n}",
    timeout: 30,
    retry_count: 3,
    is_enabled: false,
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setFormData(prev => ({
          ...prev,
          name: `${template.name} - ${workspaces.find(w => w.slug === selectedWorkspace)?.name || ""}`,
          endpoint_url: template.endpoint_url || "",
          method: template.method,
          headers: JSON.stringify(template.headers, null, 2),
          json_template: JSON.stringify(template.json_template, null, 2),
        }));
      }
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
      console.error("설정 생성 오류:", error);
      alert("JSON 형식을 확인해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6">
        <h2 className="text-xl font-medium text-custom-text-100 mb-6">새 알림 설정 추가</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 템플릿 선택 */}
          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              템플릿 선택 (선택사항)
            </label>
            <Select
              value={selectedTemplate}
              onChange={(value) => handleTemplateSelect(value)}
              placeholder="템플릿을 선택하면 자동으로 설정됩니다"
            >
              <option value="">직접 설정</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.service_type})
                </option>
              ))}
            </Select>
          </div>

          {/* 기본 정보 */}
          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              설정 이름 *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="예: Slack 알림 설정"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              엔드포인트 URL *
            </label>
            <Input
              type="url"
              value={formData.endpoint_url}
              onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-custom-text-200 mb-2">
                HTTP 메소드
              </label>
              <Select
                value={formData.method}
                onChange={(value) => setFormData(prev => ({ ...prev, method: value }))}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-custom-text-200 mb-2">
                타임아웃 (초)
              </label>
              <Input
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                min="1"
                max="300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              재시도 횟수
            </label>
            <Input
              type="number"
              value={formData.retry_count}
              onChange={(e) => setFormData(prev => ({ ...prev, retry_count: parseInt(e.target.value) }))}
              min="0"
              max="10"
            />
          </div>

          {/* 헤더 설정 */}
          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              HTTP 헤더 (JSON)
            </label>
            <TextArea
              value={formData.headers}
              onChange={(e) => setFormData(prev => ({ ...prev, headers: e.target.value }))}
              rows={4}
              placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer your-token"\n}'
              className="font-mono text-sm"
            />
          </div>

          {/* JSON 템플릿 */}
          <div>
            <label className="block text-sm font-medium text-custom-text-200 mb-2">
              JSON 템플릿
            </label>
            <TextArea
              value={formData.json_template}
              onChange={(e) => setFormData(prev => ({ ...prev, json_template: e.target.value }))}
              rows={8}
              placeholder='{\n  "text": "{{message}}",\n  "user": "{{user_email}}",\n  "issue": "{{issue_name}}"\n}'
              className="font-mono text-sm"
            />
            <p className="text-xs text-custom-text-400 mt-1">
              사용 가능한 변수: {{user_id}}, {{user_email}}, {{title}}, {{message}}, {{issue_name}}, {{workspace_name}}, {{project_name}} 등
            </p>
          </div>

          {/* 활성화 여부 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_enabled"
              checked={formData.is_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
              className="rounded border-custom-border-200"
            />
            <label htmlFor="is_enabled" className="text-sm text-custom-text-200">
              생성 후 즉시 활성화
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};