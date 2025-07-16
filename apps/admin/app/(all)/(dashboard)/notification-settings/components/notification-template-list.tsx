"use client";

import { useState } from "react";
import { Button, Badge } from "@plane/ui";
import { INotificationTemplate } from "../page";
import { CreateTemplateModal } from "./create-template-modal";

interface NotificationTemplateListProps {
  templates: INotificationTemplate[];
  onRefresh: () => Promise<void>;
}

export const NotificationTemplateList: React.FC<NotificationTemplateListProps> = ({
  templates,
  onRefresh,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getServiceTypeBadge = (serviceType: string) => {
    const variants: Record<string, "primary" | "secondary" | "success" | "warning"> = {
      slack: "success",
      discord: "primary",
      teams: "warning",
      webhook: "secondary",
      custom: "primary",
    };
    
    return variants[serviceType] || "secondary";
  };

  const getServiceTypeLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      slack: "Slack",
      discord: "Discord",
      teams: "Teams",
      webhook: "Webhook",
      custom: "Custom",
    };
    
    return labels[serviceType] || serviceType;
  };

  const handleCreateSystemTemplates = async () => {
    try {
      // 시스템 템플릿 생성 API 호출
      await fetch("/api/notification-templates/create-system-templates/", {
        method: "POST",
        credentials: "include",
      });
      
      // 템플릿 목록 새로고침
      await onRefresh();
    } catch (error) {
      console.error("시스템 템플릿 생성 오류:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-custom-text-100">템플릿 관리</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCreateSystemTemplates}
          >
            시스템 템플릿 생성
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            size="sm"
          >
            새 템플릿 추가
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8 border border-custom-border-200 rounded-lg">
          <p className="text-custom-text-400 mb-4">템플릿이 없습니다.</p>
          <div className="flex justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateSystemTemplates}
            >
              시스템 템플릿 생성
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              size="sm"
            >
              새 템플릿 추가
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="border border-custom-border-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-custom-text-100">{template.name}</h4>
                    <Badge variant={getServiceTypeBadge(template.service_type)}>
                      {getServiceTypeLabel(template.service_type)}
                    </Badge>
                  </div>
                  {template.is_system_template && (
                    <Badge variant="outline" className="mb-2">
                      시스템 템플릿
                    </Badge>
                  )}
                  <p className="text-sm text-custom-text-400 mb-2">
                    {template.description || "설명 없음"}
                  </p>
                  <div className="text-xs text-custom-text-400 space-y-1">
                    {template.endpoint_url && (
                      <p><strong>엔드포인트:</strong> {template.endpoint_url}</p>
                    )}
                    <p><strong>메소드:</strong> {template.method}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-custom-border-200 pt-3">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-custom-text-300 hover:text-custom-text-100">
                    템플릿 보기
                  </summary>
                  <div className="mt-2 p-3 bg-custom-background-80 rounded border text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                    <pre>{JSON.stringify(template.json_template, null, 2)}</pre>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            // 템플릿 생성 API 호출
            try {
              await fetch("/api/notification-templates/", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(data),
              });
              
              await onRefresh();
              setShowCreateModal(false);
            } catch (error) {
              console.error("템플릿 생성 오류:", error);
            }
          }}
        />
      )}
    </div>
  );
};