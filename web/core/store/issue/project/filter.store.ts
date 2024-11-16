import isEmpty from "lodash/isEmpty";
import set from "lodash/set";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
// base class
import { computedFn } from "mobx-utils";
import {
  IIssueFilterOptions,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TIssueKanbanFilters,
  IIssueFilters,
  TIssueParams,
  IssuePaginationOptions,
} from "@plane/types";
import { EIssueFilterType, EIssuesStoreType } from "@/constants/issue";
import { handleIssueQueryParamsByLayout } from "@/helpers/issue.helper";
import { IssueFiltersService } from "@/services/issue_filter.service";
import { IBaseIssueFilterStore, IssueFilterHelperStore } from "../helpers/issue-filter-helper.store";
// helpers
// types
import { IIssueRootStore } from "../root.store";
// constants
// services

export interface IProjectIssuesFilter extends IBaseIssueFilterStore {
  //helper actions
  getFilterParams: (
    options: IssuePaginationOptions,
    projectId: string,
    cursor: string | undefined,
    groupId: string | undefined,
    subGroupId: string | undefined
  ) => Partial<Record<TIssueParams, string | boolean>>;
  // action
  fetchFilters: (workspaceSlug: string, projectId: string) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties | TIssueKanbanFilters
  ) => Promise<void>;
}

export class ProjectIssuesFilter extends IssueFilterHelperStore implements IProjectIssuesFilter {
  // observables
  filters: { [projectId: string]: IIssueFilters } = {};
  // root store
  rootIssueStore: IIssueRootStore;
  // services
  issueFilterService;

  constructor(_rootStore: IIssueRootStore) {
    super();
    makeObservable(this, {
      // observables
      filters: observable,
      // computed
      issueFilters: computed,
      appliedFilters: computed,
      // actions
      fetchFilters: action,
      updateFilters: action,
    });
    // root store
    this.rootIssueStore = _rootStore;
    // services
    this.issueFilterService = new IssueFiltersService();
  }

  get issueFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getIssueFilters(projectId);
  }

  get appliedFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getAppliedFilters(projectId);
  }

  getIssueFilters(projectId: string) {
    const displayFilters = this.filters[projectId] || undefined;
    if (isEmpty(displayFilters)) return undefined;

    return this.computedIssueFilters(displayFilters);
  }

  getAppliedFilters(projectId: string) {
    const userFilters = this.getIssueFilters(projectId);
    if (!userFilters) return undefined;

    const filteredParams = handleIssueQueryParamsByLayout(userFilters?.displayFilters?.layout, "issues");
    if (!filteredParams) return undefined;

    const filteredRouteParams: Partial<Record<TIssueParams, string | boolean>> = this.computedFilteredParams(
      userFilters?.filters as IIssueFilterOptions,
      userFilters?.displayFilters as IIssueDisplayFilterOptions,
      filteredParams
    );

    return filteredRouteParams;
  }

  getFilterParams = computedFn(
    (
      options: IssuePaginationOptions,
      projectId: string,
      cursor: string | undefined,
      groupId: string | undefined,
      subGroupId: string | undefined
    ): Partial<Record<TIssueParams, string | boolean>> => {
      // console.log("Filter Params Input:", {
      //   options,
      //   projectId,
      //   cursor,
      //   groupId,
      //   subGroupId
      // });

      const filterParams = this.getAppliedFilters(projectId);
      const paginationParams = this.getPaginationParams(filterParams, options, cursor, groupId, subGroupId);

      // 캘린더 뷰인 경우
      const displayFilters = this.filters[projectId]?.displayFilters;
      if (displayFilters?.layout === "calendar") {
        const calendarParams = this.getCalendarFilterParams(new Date());
        
        // 타입 안전한 방식으로 파라미터 병합
        const mergedParams: Partial<Record<TIssueParams, string | boolean>> = {
          ...paginationParams,
          group_by: "target_date",
          start_date: calendarParams.start_date?.[0] || "",
          target_date: calendarParams.target_date?.[0] || "",
          order_by: "-created_at",
          per_page: "100"
        };

        return mergedParams;
      }

      console.log("Final Pagination Params:", paginationParams);
      return paginationParams;
    }
  );

  fetchFilters = async (workspaceSlug: string, projectId: string) => {
    try {
      const _filters = await this.issueFilterService.fetchProjectIssueFilters(workspaceSlug, projectId);

      const filters = this.computedFilters(_filters?.filters);
      const displayFilters = this.computedDisplayFilters(_filters?.display_filters);
      const displayProperties = this.computedDisplayProperties(_filters?.display_properties);

      // fetching the kanban toggle helpers in the local storage
      const kanbanFilters = {
        group_by: [],
        sub_group_by: [],
      };
      const currentUserId = this.rootIssueStore.currentUserId;
      if (currentUserId) {
        const _kanbanFilters = this.handleIssuesLocalFilters.get(
          EIssuesStoreType.PROJECT,
          workspaceSlug,
          projectId,
          currentUserId
        );
        kanbanFilters.group_by = _kanbanFilters?.kanban_filters?.group_by || [];
        kanbanFilters.sub_group_by = _kanbanFilters?.kanban_filters?.sub_group_by || [];
      }

      runInAction(() => {
        set(this.filters, [projectId, "filters"], filters);
        set(this.filters, [projectId, "displayFilters"], displayFilters);
        set(this.filters, [projectId, "displayProperties"], displayProperties);
        set(this.filters, [projectId, "kanbanFilters"], kanbanFilters);
      });
    } catch (error) {
      throw error;
    }
  };

  updateFilters = async (
    workspaceSlug: string,
    projectId: string,
    type: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties | TIssueKanbanFilters
  ) => {
    try {
      if (isEmpty(this.filters) || isEmpty(this.filters[projectId]) || isEmpty(filters)) return;

      const _filters = {
        filters: this.filters[projectId].filters as IIssueFilterOptions,
        displayFilters: this.filters[projectId].displayFilters as IIssueDisplayFilterOptions,
        displayProperties: this.filters[projectId].displayProperties as IIssueDisplayProperties,
        kanbanFilters: this.filters[projectId].kanbanFilters as TIssueKanbanFilters,
      };

      switch (type) {
        case EIssueFilterType.FILTERS: {
          const updatedFilters = filters as IIssueFilterOptions;
          _filters.filters = { ..._filters.filters, ...updatedFilters };

          runInAction(() => {
            Object.keys(updatedFilters).forEach((_key) => {
              set(this.filters, [projectId, "filters", _key], updatedFilters[_key as keyof IIssueFilterOptions]);
            });
          });

          this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
          await this.issueFilterService.patchProjectIssueFilters(workspaceSlug, projectId, {
            filters: _filters.filters,
          });
          break;
        }
        case EIssueFilterType.DISPLAY_FILTERS: {
          const updatedDisplayFilters = filters as IIssueDisplayFilterOptions;
          _filters.displayFilters = { ..._filters.displayFilters, ...updatedDisplayFilters };

          // 캘린더 뷰로 전환하는 경우
          if (updatedDisplayFilters.layout === "calendar") {
            const calendarParams = this.getCalendarFilterParams(new Date());
            _filters.filters = {
              ..._filters.filters,
              start_date: calendarParams.start_date,
              target_date: calendarParams.target_date
            };
          }

          runInAction(() => {
            Object.keys(updatedDisplayFilters).forEach((_key) => {
              set(
                this.filters,
                [projectId, "displayFilters", _key],
                updatedDisplayFilters[_key as keyof IIssueDisplayFilterOptions]
              );
            });
          });

          if (this.getShouldClearIssues(updatedDisplayFilters)) {
            this.rootIssueStore.projectIssues.clear(true, true);
          }

          if (this.getShouldReFetchIssues(updatedDisplayFilters)) {
            this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
          }

          await this.issueFilterService.patchProjectIssueFilters(workspaceSlug, projectId, {
            display_filters: _filters.displayFilters,
            filters: _filters.filters
          });

          break;
        }
        case EIssueFilterType.DISPLAY_PROPERTIES: {
          const updatedDisplayProperties = filters as IIssueDisplayProperties;
          _filters.displayProperties = { ..._filters.displayProperties, ...updatedDisplayProperties };

          runInAction(() => {
            Object.keys(updatedDisplayProperties).forEach((_key) => {
              set(
                this.filters,
                [projectId, "displayProperties", _key],
                updatedDisplayProperties[_key as keyof IIssueDisplayProperties]
              );
            });
          });

          await this.issueFilterService.patchProjectIssueFilters(workspaceSlug, projectId, {
            display_properties: _filters.displayProperties,
          });
          break;
        }

        case EIssueFilterType.KANBAN_FILTERS: {
          const updatedKanbanFilters = filters as TIssueKanbanFilters;
          _filters.kanbanFilters = { ..._filters.kanbanFilters, ...updatedKanbanFilters };

          const currentUserId = this.rootIssueStore.currentUserId;
          if (currentUserId)
            this.handleIssuesLocalFilters.set(EIssuesStoreType.PROJECT, type, workspaceSlug, projectId, currentUserId, {
              kanban_filters: _filters.kanbanFilters,
            });

          runInAction(() => {
            Object.keys(updatedKanbanFilters).forEach((_key) => {
              set(
                this.filters,
                [projectId, "kanbanFilters", _key],
                updatedKanbanFilters[_key as keyof TIssueKanbanFilters]
              );
            });
          });

          break;
        }
        default:
          break;
      }
    } catch (error) {
      this.fetchFilters(workspaceSlug, projectId);
      throw error;
    }
  };
}
