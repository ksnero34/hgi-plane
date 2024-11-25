import { FC, useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { X } from "lucide-react";
import { Input, Button } from "@plane/ui";

interface IFileSettings {
  allowed_extensions: string[];
  max_file_size: number;
}

interface Props {
  settings: IFileSettings | undefined;
  onSubmit: (data: Partial<IFileSettings>) => Promise<IFileSettings>;
}

// 확장자 입력 컴포넌트
const ExtensionInput: FC<{
  value: string[];
  onChange: (value: string[]) => void;
}> = ({ value, onChange }) => {
  const [newExtension, setNewExtension] = useState("");

  const handleAdd = () => {
    if (!newExtension) return;
    const extension = newExtension.toLowerCase().replace(/^\./, ""); // 점(.) 제거
    if (!value.includes(extension)) {
      onChange([...value, extension]);
    }
    setNewExtension("");
  };

  const handleRemove = (extension: string) => {
    onChange(value.filter((ext) => ext !== extension));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={newExtension}
          onChange={(e) => setNewExtension(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="확장자 입력 (예: pdf)"
          className="flex-grow"
        />
        <Button
          type="button"
          variant="outline-primary"
          onClick={handleAdd}
        >
          추가
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((extension) => (
          <div
            key={extension}
            className="flex items-center gap-1 px-2 py-1 bg-custom-background-80 rounded-md"
          >
            <span className="text-sm">{extension}</span>
            <button
              type="button"
              onClick={() => handleRemove(extension)}
              className="text-custom-text-200 hover:text-custom-text-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FileSettingsForm: FC<Props> = observer(({ settings, onSubmit }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      allowed_extensions: settings?.allowed_extensions ?? [],
      max_file_size: settings?.max_file_size ? settings.max_file_size / (1024 * 1024) : 5 // bytes를 MB로 변환
    }
  });

  const handleFormSubmit = (data: any) => {
    // MB를 bytes로 변환해서 서버로 전송
    return onSubmit({
      ...data,
      max_file_size: Math.floor(data.max_file_size * 1024 * 1024) // MB를 bytes로 변환
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-custom-text-200">
            허용되는 파일 형식
          </label>
          <Controller
            name="allowed_extensions"
            control={control}
            render={({ field }) => (
              <ExtensionInput
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-custom-text-200">
            최대 파일 크기 (MB)
          </label>
          <Controller
            name="max_file_size"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                min={1}
                max={100}
                className="w-full"
              />
            )}
          />
        </div>
      </div>

      <Button type="submit" variant="accent-primary">
        설정 저장
      </Button>
    </form>
  );
});