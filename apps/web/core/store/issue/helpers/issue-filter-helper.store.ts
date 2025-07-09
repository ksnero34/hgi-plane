import isEmpty from "lodash/isEmpty";
// plane constants
import {
  EIssueGroupByToServerOptions,
  EServerGroupByToFilterOptions,
  EIssueLayoutTypes,
  EIssuesStoreType,
  EIssueFilterType,
  ENABLE_ISSUE_DEPENDENCIES,
} from "@plane/constants";
import {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  IIssueFilters,
  IIssueFiltersResponse,
  IssuePaginationOptions,
  TIssueKanbanFilters,
  TIssueParams,
  TStaticViewTypes,
} from "@plane/types";
// helpers
import { getComputedDisplayFilters, getComputedDisplayProperties } from "@/helpers/issue.helper";
// lib
import { storage } from "@/lib/local-storage";

interface ILocalStoreIssueFilters {
  key: EIssuesStoreType;
  workspaceSlug: string;
  viewId: string | undefined; // It can be projectId, moduleId, cycleId, projectViewId
  userId: string | undefined;
  filters: IIssueFilters;
}

export interface IBaseIssueFilterStore {
  // observables
  filters: Record<string, IIssueFilters>;
  //computed
  appliedFilters: Partial<Record<TIssueParams, string | boolean>> | undefined;
  issueFilters: IIssueFilters | undefined;
}

export interface IIssueFilterHelperStore {
  computedIssueFilters(filters: IIssueFilters): IIssueFilters;
  computedFilteredParams(
    filters: IIssueFilterOptions,
    displayFilters: IIssueDisplayFilterOptions,
    filteredParams: TIssueParams[]
  ): Partial<Record<TIssueParams, string | boolean>>;
  computedFilters(filters: IIssueFilterOptions): IIssueFilterOptions;
  computedDisplayFilters(
    displayFilters: IIssueDisplayFilterOptions,
    defaultValues?: IIssueDisplayFilterOptions
  ): IIssueDisplayFilterOptions;
  computedDisplayProperties(filters: IIssueDisplayProperties): IIssueDisplayProperties;
}

export class IssueFilterHelperStore implements IIssueFilterHelperStore {
  constructor() {}

  /**
   * @description This method is used to apply the display filters on the issues
   * @param {IIssueFilters} filters
   * @returns {IIssueFilters}
   */
  computedIssueFilters = (filters: IIssueFilters): IIssueFilters => ({
    filters: isEmpty(filters?.filters) ? undefined : filters?.filters,
    displayFilters: isEmpty(filters?.displayFilters) ? undefined : filters?.displayFilters,
    displayProperties: isEmpty(filters?.displayProperties) ? undefined : filters?.displayProperties,
    kanbanFilters: isEmpty(filters?.kanbanFilters) ? undefined : filters?.kanbanFilters,
  });

  /**
   * @description This method is used to convert the filters array params to string params
   * @param {IIssueFilterOptions} filters
   * @param {IIssueDisplayFilterOptions} displayFilters
   * @param {string[]} acceptableParamsByLayout
   * @returns {Partial<Record<TIssueParams, string | boolean>>}
   */
  computedFilteredParams = (
    filters: IIssueFilterOptions,
    displayFilters: IIssueDisplayFilterOptions,
    acceptableParamsByLayout: TIssueParams[]
  ) => {
    const computedFilters: Partial<Record<TIssueParams, undefined | string[] | boolean | string | { [field_id: string]: string[]; }>> = {
      // issue filters
      priority: filters?.priority || undefined,
      state_group: filters?.state_group || undefined,
      state: filters?.state || undefined,
      assignees: filters?.assignees || undefined,
      mentions: filters?.mentions || undefined,
      created_by: filters?.created_by || undefined,
      labels: filters?.labels || undefined,
      cycle: filters?.cycle || undefined,
      module: filters?.module || undefined,
      start_date: filters?.start_date || undefined,
      target_date: filters?.target_date || undefined,
      project: filters?.project || undefined,
      team_project: filters?.team_project || undefined,
      parent_id: filters?.parent_id || undefined,
      subscriber: filters?.subscriber || undefined,
      issue_type: filters?.issue_type || undefined,
      custom_fields: filters?.custom_fields || undefined,
      // display filters
      group_by: displayFilters?.group_by ? EIssueGroupByToServerOptions[displayFilters.group_by] : undefined,
      sub_group_by: displayFilters?.sub_group_by
        ? EIssueGroupByToServerOptions[displayFilters.sub_group_by]
        : undefined,
      order_by: displayFilters?.order_by || undefined,
      type: displayFilters?.type || undefined,
      sub_issue: displayFilters?.sub_issue ?? true,
      my_issues_only: displayFilters?.my_issues_only ?? false,
    };

    // console.log('computedFilteredParams - computedFilters.custom_fields:', computedFilters.custom_fields);

    // target_date within 필터 처리
    if (filters?.target_date && Array.isArray(filters.target_date)) {
      const processedDates = filters.target_date.map(dateFilter => {
        const [duration, filterType, offset] = dateFilter.split(";");
        
        if (filterType === "within" && offset === "fromnow") {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          
          const [amount, unit] = duration.split("_");
          const futureDate = new Date(now);
          
          if (unit === "weeks") {
            futureDate.setDate(futureDate.getDate() + parseInt(amount) * 7);
          } else if (unit === "days") {
            futureDate.setDate(futureDate.getDate() + parseInt(amount));
          }
          
          return `${futureDate.toISOString().split('T')[0]};after;fromnow`;
        }
        
        return dateFilter;
      });
      
      computedFilters.target_date = processedDates;
    }

    const issueFiltersParams: Partial<Record<TIssueParams, boolean | string>> = {};
    Object.keys(computedFilters).forEach((key) => {
      const _key = key as TIssueParams;
      const _value: string | boolean | string[] | { [field_id: string]: string[]; } | undefined = computedFilters[_key];
      const nonEmptyArrayValue = Array.isArray(_value) && _value.length === 0 ? undefined : _value;
      
      // console.log(`Processing filter ${_key}:`, {
      //   value: _value,
      //   nonEmptyArrayValue,
      //   isAcceptable: acceptableParamsByLayout.includes(_key)
      // });
      
      if (nonEmptyArrayValue != undefined && acceptableParamsByLayout.includes(_key)) {
        // custom_fields는 특별한 처리가 필요 (객체를 JSON 문자열로 변환)
        if (_key === "custom_fields" && typeof nonEmptyArrayValue === "object" && !Array.isArray(nonEmptyArrayValue)) {
          issueFiltersParams[_key] = JSON.stringify(nonEmptyArrayValue);
        } else {
          issueFiltersParams[_key] = Array.isArray(nonEmptyArrayValue)
            ? nonEmptyArrayValue.join(",")
            : (nonEmptyArrayValue as string | boolean);
        }
      }
    });

    if (displayFilters?.layout) issueFiltersParams.layout = displayFilters?.layout;

    if (ENABLE_ISSUE_DEPENDENCIES && displayFilters.layout === EIssueLayoutTypes.GANTT)
      issueFiltersParams["expand"] = "issue_relation,issue_related";

    return issueFiltersParams;
  };

  /**
   * @description This method is used to apply the filters on the issues
   * @param {IIssueFilterOptions} filters
   * @returns {IIssueFilterOptions}
   */
  computedFilters = (filters: IIssueFilterOptions): IIssueFilterOptions => ({
    priority: filters?.priority || null,
    state: filters?.state || null,
    state_group: filters?.state_group || null,
    assignees: filters?.assignees || null,
    mentions: filters?.mentions || null,
    created_by: filters?.created_by || null,
    labels: filters?.labels || null,
    cycle: filters?.cycle || null,
    module: filters?.module || null,
    start_date: filters?.start_date || null,
    target_date: filters?.target_date || null,
    project: filters?.project || null,
    team_project: filters?.team_project || null,
    parent_id: filters?.parent_id || null,
    subscriber: filters?.subscriber || null,
    issue_type: filters?.issue_type || null,
    custom_fields: filters?.custom_fields || null,
  });

  /**
   * This PR is to get the filters of the fixed global views
   * @param currentUserId current logged in user id
   * @param type fixed view type
   * @returns filterOptions based on views
   */
  getComputedFiltersBasedOnViews = (currentUserId: string | undefined, type: TStaticViewTypes) => {
    const noFilters = this.computedFilters({});

    if (!currentUserId) return noFilters;

    switch (type) {
      case "assigned":
        return {
          ...noFilters,
          assignees: [currentUserId],
        };
      case "created":
        return {
          ...noFilters,
          created_by: [currentUserId],
        };
      case "subscribed":
        return {
          ...noFilters,
          subscriber: [currentUserId],
        };
      case "all-issues":
      default:
        return noFilters;
    }
  };

  /**
   * @description This method is used to apply the display filters on the issues
   * @param {IIssueDisplayFilterOptions} displayFilters
   * @returns {IIssueDisplayFilterOptions}
   */
  computedDisplayFilters = (
    displayFilters: IIssueDisplayFilterOptions,
    defaultValues?: IIssueDisplayFilterOptions
  ): IIssueDisplayFilterOptions => getComputedDisplayFilters(displayFilters, defaultValues);

  /**
   * @description This method is used to apply the display properties on the issues
   * @param {IIssueDisplayProperties} displayProperties
   * @returns {IIssueDisplayProperties}
   */
  computedDisplayProperties = (displayProperties: IIssueDisplayProperties): IIssueDisplayProperties =>
    getComputedDisplayProperties(displayProperties);

  handleIssuesLocalFilters = {
    fetchFiltersFromStorage: () => {
      const _filters = storage.get("issue_local_filters");
      return _filters ? JSON.parse(_filters) : [];
    },

    get: (
      currentView: EIssuesStoreType,
      workspaceSlug: string,
      viewId: string | undefined, // It can be projectId, moduleId, cycleId, projectViewId
      userId: string | undefined
    ) => {
      const storageFilters = this.handleIssuesLocalFilters.fetchFiltersFromStorage();
      const currentFilterIndex = storageFilters.findIndex(
        (filter: ILocalStoreIssueFilters) =>
          filter.key === currentView &&
          filter.workspaceSlug === workspaceSlug &&
          filter.viewId === viewId &&
          filter.userId === userId
      );
      if (!currentFilterIndex && currentFilterIndex.length < 0) return undefined;

      return storageFilters[currentFilterIndex]?.filters || {};
    },

    set: (
      currentView: EIssuesStoreType,
      filterType: EIssueFilterType,
      workspaceSlug: string,
      viewId: string | undefined, // It can be projectId, moduleId, cycleId, projectViewId
      userId: string | undefined,
      filters: Partial<IIssueFiltersResponse & { kanban_filters: TIssueKanbanFilters }>
    ) => {
      const storageFilters = this.handleIssuesLocalFilters.fetchFiltersFromStorage();
      const currentFilterIndex = storageFilters.findIndex(
        (filter: ILocalStoreIssueFilters) =>
          filter.key === currentView &&
          filter.workspaceSlug === workspaceSlug &&
          filter.viewId === viewId &&
          filter.userId === userId
      );

      if (currentFilterIndex < 0)
        storageFilters.push({
          key: currentView,
          workspaceSlug: workspaceSlug,
          viewId: viewId,
          userId: userId,
          filters: filters,
        });
      else
        storageFilters[currentFilterIndex] = {
          ...storageFilters[currentFilterIndex],
          filters: {
            ...storageFilters[currentFilterIndex].filters,
            [filterType]: filters[filterType],
          },
        };
      // All group_by "filters" are stored in a single array, will cause inconsistency in case of duplicated values
      storage.set("issue_local_filters", JSON.stringify(storageFilters));
    },
  };

  /**
   * This Method returns true if the display properties changed requires a server side update
   * @param displayFilters
   * @returns
   */
  getShouldReFetchIssues = (displayFilters: IIssueDisplayFilterOptions) => {
    // 클라이언트에서만 처리하는 필터들 (서버 재요청 불필요)
    const NON_SERVER_DISPLAY_FILTERS = ["show_empty_groups", "per_page"];
    const displayFilterKeys = Object.keys(displayFilters);

    // 서버에서 처리해야 하는 필터(NON_SERVER_DISPLAY_FILTERS에 없는 필터)가 변경되었는지 확인
    const hasServerSideFilters = displayFilterKeys.some((filterKey: string) =>
      NON_SERVER_DISPLAY_FILTERS.indexOf(filterKey) === -1
    );

    return hasServerSideFilters;
  };

  /**
   * This Method returns true if the display properties changed requires a server side update
   * @param displayFilters
   * @returns
   */
  getShouldClearIssues = (displayFilters: IIssueDisplayFilterOptions) => {
    const NON_SERVER_DISPLAY_FILTERS = ["layout"];
    const displayFilterKeys = Object.keys(displayFilters);

    return NON_SERVER_DISPLAY_FILTERS.some((serverDisplayfilter: string) =>
      displayFilterKeys.indexOf(serverDisplayfilter) !== -1
    );
  };

  /**
   * This Method is used to construct the url params along with paginated values
   * @param filterParams params generated from filters
   * @param options pagination options
   * @param cursor cursor if exists
   * @param groupId groupId if to fetch By group
   * @param subGroupId groupId if to fetch By sub group
   * @returns
   */
  getPaginationParams(
    filterParams: Partial<Record<TIssueParams, string | boolean>> | undefined,
    options: IssuePaginationOptions,
    cursor: string | undefined,
    groupId?: string,
    subGroupId?: string
  ) {
    // Use perPageFromDisplayFilter if available, otherwise use perPageCount
    const perPage = options.perPageFromDisplayFilter || options.perPageCount;
    
    // if cursor exists, use the cursor. If it doesn't exist construct the cursor based on per page count
    const pageCursor = cursor ? cursor : groupId ? `${perPage}:1:0` : `${perPage}:0:0`;

    // pagination params
    const paginationParams: Partial<Record<TIssueParams, string | boolean>> = {
      ...filterParams,
      cursor: pageCursor,
      per_page: perPage.toString(),
    };

    // If group by is specifically sent through options, like that for calendar layout, use that to group
    if (options.groupedBy) {
      paginationParams.group_by = options.groupedBy;
    }

    // If before and after dates are sent from option to filter by then, add them to filter the options
    if (options.after && options.before) {
      paginationParams["target_date"] = `${options.after};after,${options.before};before`;
    }

    // If groupId is passed down, add a filter param for that group Id
    if (groupId) {
      const groupBy = paginationParams["group_by"] as EIssueGroupByToServerOptions | undefined;
      delete paginationParams["group_by"];

      if (groupBy) {
        const groupByFilterOption = EServerGroupByToFilterOptions[groupBy];
        paginationParams[groupByFilterOption] = groupId;
      }
    }

    // If subGroupId is passed down, add a filter param for that subGroup Id
    if (subGroupId) {
      const subGroupBy = paginationParams["sub_group_by"] as EIssueGroupByToServerOptions | undefined;
      delete paginationParams["sub_group_by"];

      if (subGroupBy) {
        const subGroupByFilterOption = EServerGroupByToFilterOptions[subGroupBy];
        paginationParams[subGroupByFilterOption] = subGroupId;
      }
    }

    return paginationParams;
  }
}