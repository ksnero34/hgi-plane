import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import React from "react";
// constants
import { SPREADSHEET_SELECT_GROUP } from "@plane/constants";
// ui
import { IIssueDisplayFilterOptions, IIssueDisplayProperties, TCustomField } from "@plane/types";
// components
import { Row } from "@plane/ui";
import { cn } from "@plane/utils";
import { MultipleSelectGroupAction } from "@/components/core";
import { SpreadsheetHeaderColumn } from "@/components/issues/issue-layouts";
// helpers
// hooks
import { TSelectionHelper } from "@/hooks/use-multiple-select";

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

export const SpreadsheetHeader = observer((props: Props) => {
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
  const customFieldsMap = React.useMemo(() => {
    return customFields.reduce((acc, field) => {
      acc[`custom_field_${field.id}`] = field;
      return acc;
    }, {} as Record<string, TCustomField>);
  }, [customFields]);

  return (
    <thead className="sticky top-0 left-0 z-10 border-b border-custom-border-100">
      <tr>
        <th className="sticky left-0 z-10 h-11 w-[28rem] flex items-center bg-custom-background-90 text-sm font-medium text-custom-text-200 border-r-[0.5px] border-custom-border-200">
          <Row className="flex items-center">
            {canSelectIssues && (
              <div className="flex-shrink-0 flex items-center w-3.5 mr-1 absolute left-1 py-[11px]">
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
            <span className="flex h-full w-full flex-grow items-center py-2.5">{`${isEpic ? "Epics" : "Work items"}`}</span>
          </Row>
        </th>
        
        {spreadsheetColumnsList.map((property) => {
          // 커스텀 필드 헤더인지 확인
          if (property.toString().startsWith('custom_field_')) {
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
