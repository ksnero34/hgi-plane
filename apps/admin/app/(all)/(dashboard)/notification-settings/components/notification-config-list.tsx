import { useState } from "react";
import { Button } from "@plane/ui";
import type { INotificationConfig } from "../page";
import { ConfigEditModal } from "./config-edit-modal";

interface NotificationConfigListProps {
  configs: INotificationConfig[];
  selectedWorkspace: string;
  onUpdate: (configId: string, data: Partial<INotificationConfig>) => Promise<void>;
  onDelete: (configId: string) => Promise<void>;
  onTest: (configId: string) => Promise<void>;
  onCreateNew: () => void;
}

export const NotificationConfigList: React.FC<NotificationConfigListProps> = ({
  configs,
  selectedWorkspace,
  onUpdate,
  onDelete,
  onTest,
  onCreateNew,
}) => {
  const [editingConfig, setEditingConfig] = useState<INotificationConfig | null>(null);

  const handleToggleEnabled = async (config: INotificationConfig) => {
    await onUpdate(config.id, { is_enabled: !config.is_enabled });
  };

  const handleEdit = (config: INotificationConfig) => {
    setEditingConfig(config);
  };

  const handleDelete = async (config: INotificationConfig) => {
    if (window.confirm(`"${config.name}" 설정을 삭제하시겠습니까?`)) {
      await onDelete(config.id);
    }
  };

  const handleTest = async (config: INotificationConfig) => {
    if (window.confirm(`"${config.name}" 설정으로 테스트 알림을 전송하시겠습니까?`)) {
      await onTest(config.id);
    }
  };

  if (!selectedWorkspace) {
    return (
      <div className="text-center py-8">
        <p className="text-custom-text-400">워크스페이스를 선택해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-custom-text-100">알림 설정</h3>
        <Button variant="primary" size="sm" onClick={onCreateNew}>
          새 설정 추가
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-8 border border-custom-border-200 rounded-lg">
          <p className="text-custom-text-400 mb-4">설정된 알림이 없습니다.</p>
          <Button variant="primary" size="sm" onClick={onCreateNew}>
            첫 번째 설정 추가
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className="border border-custom-border-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-custom-text-100">{config.name}</h4>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        config.is_enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {config.is_enabled ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div className="text-sm text-custom-text-400 space-y-1">
                    <p>
                      <strong>엔드포인트:</strong> {config.endpoint_url}
                    </p>
                    <p>
                      <strong>메소드:</strong> {config.method}
                    </p>
                    <p>
                      <strong>타임아웃:</strong> {config.timeout}초
                    </p>
                    <p>
                      <strong>재시도 횟수:</strong> {config.retry_count}회
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline-primary" size="sm" onClick={() => handleToggleEnabled(config)}>
                    {config.is_enabled ? "비활성화" : "활성화"}
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => handleTest(config)}>
                    테스트
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => handleEdit(config)}>
                    편집
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleDelete(config)}
                    className="text-red-500 hover:text-red-600"
                  >
                    삭제
                  </Button>
                </div>
              </div>

              <div className="border-t border-custom-border-200 pt-3">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-custom-text-300 hover:text-custom-text-100">
                    템플릿 보기
                  </summary>
                  <div className="mt-2 p-3 bg-custom-background-80 rounded border text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(config.json_template, null, 2)}</pre>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingConfig && (
        <ConfigEditModal
          isOpen={!!editingConfig}
          onClose={() => setEditingConfig(null)}
          config={editingConfig}
          onSubmit={async (data) => {
            await onUpdate(editingConfig.id, data);
            setEditingConfig(null);
          }}
        />
      )}
    </div>
  );
};
