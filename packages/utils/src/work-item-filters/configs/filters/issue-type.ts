// plane imports
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR } from "@plane/types";
import type { IProjectIssueType, TFilterProperty, TSupportedOperators } from "@plane/types";
// local imports
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";
import type { IFilterIconConfig, TCreateFilterConfig, TCreateFilterConfigParams } from "../../../rich-filters";

/**
 * Issue type filter specific params
 */
export type TCreateIssueTypeFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<IProjectIssueType> & {
    issueTypes: IProjectIssueType[];
  };

/**
 * Helper to get the issue type multi select config
 * @param params - The filter params
 * @returns The issue type multi select config
 */
export const getIssueTypeMultiSelectConfig = (
  params: TCreateIssueTypeFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<IProjectIssueType, string, IProjectIssueType>(
    {
      items: params.issueTypes,
      getId: (issueType) => issueType.issue_type.id,
      getLabel: (issueType) => issueType.issue_type.name,
      getValue: (issueType) => issueType.issue_type.id,
      getIconData: (issueType) => issueType,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      ...params,
    }
  );

/**
 * Get the issue type filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the issue type filter config
 */
export const getIssueTypeFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateIssueTypeFilterParams> =>
  (params: TCreateIssueTypeFilterParams) =>
    createFilterConfig<P, string>({
      id: key,
      label: "작업항목 타입",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getIssueTypeMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
