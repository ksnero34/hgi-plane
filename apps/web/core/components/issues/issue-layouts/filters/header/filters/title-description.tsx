import React, { useState } from "react";
import { observer } from "mobx-react";
import { Search } from "lucide-react";
import { useTranslation } from "@plane/i18n";

// components
import { FilterHeader } from "../helpers";

type Props = {
  appliedFilters: string | null;
  handleUpdate: (val: string) => void;
  searchQuery: string;
};

export const FilterTitleDescription: React.FC<Props> = observer((props) => {
  const { appliedFilters, handleUpdate } = props;
  // hooks
  const { t } = useTranslation();
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [inputValue, setInputValue] = useState(appliedFilters || "");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleApply = () => {
    handleUpdate(inputValue);
  };

  const handleClear = () => {
    setInputValue("");
    handleUpdate("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  return (
    <>
      <FilterHeader
        title={`제목 및 설명 검색 ${appliedFilters ? " (1)" : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div className="space-y-2 px-2">
          <div className="flex items-center gap-1.5 rounded border-[0.5px] border-custom-border-200 bg-custom-background-90 px-2 py-1.5">
            <Search className="text-custom-text-400" size={14} strokeWidth={2} />
            <input
              type="text"
              className="w-full bg-custom-background-90 text-sm outline-none placeholder:text-custom-text-400"
              placeholder="제목 또는 설명에서 검색..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-custom-text-300 hover:text-custom-text-200"
              >
                지우기
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              className="text-xs font-medium text-custom-primary-100 hover:text-custom-primary-200"
              disabled={!inputValue}
            >
              적용
            </button>
          </div>
          {appliedFilters && <div className="text-xs text-custom-text-300 px-1">현재 필터: "{appliedFilters}"</div>}
        </div>
      )}
    </>
  );
});
