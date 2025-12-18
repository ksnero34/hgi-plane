import { observer } from "mobx-react";
import { useMemo } from "react";
import { useParams } from "next/navigation";
// constants
import { SPREADSHEET_SELECT_GROUP } from "@plane/constants";
// ui
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TCustomField } from "@plane/types";
// components
import { cn } from "@plane/utils";
import { MultipleSelectGroupAction } from "@/components/core/multiple-select";
// hooks
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { SpreadsheetHeaderColumn } from "./spreadsheet-header-column";

interface Props {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  canEditProperties: (projectId: string | undefined) => boolean;
  isEstimateEnabled: boolean;
  spreadsheetColumnsList: (keyof IIssueDisplayProperties)[];
  selectionHelpers: TSelectionHelper;
  isEpic?: boolean;
  customFields?: TCustomField[];
}

export const SpreadsheetHeader = observer(function SpreadsheetHeader(props: Props) {
  const {
    displayProperties,
    displayFilters,
    handleDisplayFilterUpdate,
    canEditProperties,
    isEstimateEnabled,
    spreadsheetColumnsList,
    selectionHelpers,
    isEpic = false,
    customFields = [],
  } = props;
  // router
  const { projectId } = useParams();
  // derived values
  const isGroupSelectionEmpty = selectionHelpers.isGroupSelected(SPREADSHEET_SELECT_GROUP) === "empty";
  // auth
  const canSelectIssues = canEditProperties(projectId?.toString()) && !selectionHelpers.isSelectionDisabled;

  // 커스텀 필드 맵 생성
  const customFieldsMap = useMemo(() => {
    return customFields.reduce(
      (acc, field) => {
        acc[`custom_field_${field.id}`] = field;
        return acc;
      },
      {} as Record<string, TCustomField>
    );
  }, [customFields]);

  return (
    <thead className="sticky top-0 left-0 z-[12] border-b-[0.5px] border-custom-border-100">
      <tr>
        {/* Single header column containing both identifier and workitem */}
        <th
          className="group/list-header sticky left-0 z-[15] h-11 w-[28rem] flex items-center gap-1 bg-custom-background-90 text-sm font-medium before:absolute before:h-full before:right-0 before:border-custom-border-100"
          tabIndex={-1}
        >
          <div className="flex items-center gap-2 h-full w-full px-page-x">
            {/* Workitem header section */}
            <div className="flex items-center gap-1 flex-grow h-full py-2.5 min-w-80">
              {canSelectIssues && (
                <div className="flex-shrink-0 flex items-center w-3.5 mr-1">
                  <MultipleSelectGroupAction
                    className={cn(
                      "size-3.5 opacity-0 pointer-events-none group-hover/list-header:opacity-100 group-hover/list-header:pointer-events-auto !outline-none",
                      {
                        "opacity-100 pointer-events-auto": !isGroupSelectionEmpty,
                      }
                    )}
                    groupID={SPREADSHEET_SELECT_GROUP}
                    selectionHelpers={selectionHelpers}
                  />
                </div>
              )}
              <span className="text-sm font-medium">{`${isEpic ? "Epics" : "Work items"}`}</span>
            </div>
          </div>
        </th>

        {spreadsheetColumnsList.map((property) => {
          // 커스텀 필드 헤더인지 확인
          if (property.toString().startsWith("custom_field_")) {
            const customField = customFieldsMap[property.toString()];
            if (!customField) return null;

            return (
              <th
                key={property}
                className="h-11 w-full min-w-36 max-w-48 items-center bg-custom-background-90 text-sm font-medium text-custom-text-200 px-2 py-1 border-r-[0.5px] border-custom-border-200"
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{customField.name}</span>
                </div>
              </th>
            );
          }

          // 기본 속성 헤더
          return (
            <SpreadsheetHeaderColumn
              key={property}
              property={property}
              displayProperties={displayProperties}
              displayFilters={displayFilters}
              handleDisplayFilterUpdate={handleDisplayFilterUpdate}
              isEstimateEnabled={isEstimateEnabled}
              isEpic={isEpic}
            />
          );
        })}
      </tr>
    </thead>
  );
});
