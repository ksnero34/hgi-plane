// plane imports
import { EQUALITY_OPERATOR, TEXT_OPERATOR } from "@plane/types";
import type { TFilterProperty, TSupportedOperators } from "@plane/types";
// local imports
import { createFilterConfig, createOperatorConfigEntry, getTextInputConfig } from "../../../rich-filters";
import type { IFilterIconConfig, TCreateFilterConfig, TCreateFilterConfigParams } from "../../../rich-filters";

/**
 * Search filter specific params
 */
export type TCreateSearchFilterParams = TCreateFilterConfigParams & IFilterIconConfig<never>;

/**
 * Get the search filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the search filter config
 */
export const getSearchFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateSearchFilterParams> =>
  (params: TCreateSearchFilterParams) =>
    createFilterConfig<P, string>({
      id: key,
      label: "제목 또는 내용으로 검색",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(TEXT_OPERATOR.CONTAINS, params, (updatedParams) =>
          getTextInputConfig({
            singleValueOperator: EQUALITY_OPERATOR.EXACT,
            ...updatedParams,
          })
        ),
      ]),
    });
