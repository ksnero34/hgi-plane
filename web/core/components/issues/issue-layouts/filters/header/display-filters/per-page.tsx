import React, { useState } from "react";
import { observer } from "mobx-react";
import { PER_PAGE_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

// components
import { FilterHeader, FilterOption } from "@/components/issues";

type Props = {
  selectedPerPage: number | undefined;
  handleUpdate: (val: number) => void;
  perPageOptions: number[];
};

export const FilterPerPage: React.FC<Props> = observer((props) => {
  const { selectedPerPage, handleUpdate, perPageOptions } = props;
  // hooks
  const { t } = useTranslation();

  const [previewEnabled, setPreviewEnabled] = useState(true);

  const activePerPage = selectedPerPage ?? 50;

  return (
    <>
      <FilterHeader
        title={t("common.per_page")}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {PER_PAGE_OPTIONS.filter((option) => perPageOptions.includes(option.key)).map((perPage) => (
            <FilterOption
              key={perPage?.key}
              isChecked={activePerPage === perPage?.key ? true : false}
              onClick={() => handleUpdate(perPage.key)}
              title={t(perPage.titleTranslationKey)}
              multiple={false}
            />
          ))}
        </div>
      )}
    </>
  );
}); 