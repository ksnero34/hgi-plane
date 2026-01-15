import type { ReactNode } from "react";
import { useRef, useState, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { usePopper } from "react-popper";
import { Search } from "lucide-react";
import { Combobox } from "@headlessui/react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { StateGroupIcon, ChevronDownIcon } from "@plane/propel/icons";
import type { IState } from "@plane/types";
import { ComboDropDown, Spinner } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { cn } from "@plane/utils";
// components
import { DropdownButton } from "@/components/dropdowns/buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "@/components/dropdowns/constants";
import type { TDropdownProps } from "@/components/dropdowns/types";
import { WorkflowReviewerModal } from "@/components/project/settings/workflow-reviewer-modal";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useIssues } from "@/hooks/store/use-issues";
import { EIssuesStoreType } from "@plane/types";
// plane web imports
import { StateOption } from "@/plane-web/components/workflow";

export type TWorkItemStateDropdownBaseProps = TDropdownProps & {
  alwaysAllowStateChange?: boolean;
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  filterAvailableStateIds?: boolean;
  getStateById: (stateId: string | null | undefined) => IState | undefined;
  iconSize?: string;
  isForWorkItemCreation?: boolean;
  isInitializing?: boolean;
  onChange: (val: string) => void;
  onClose?: () => void;
  onDropdownOpen?: () => void;
  projectId: string | undefined;
  renderByDefault?: boolean;
  showDefaultState?: boolean;
  stateIds: string[];
  value: string | undefined | null;
  issueId?: string;
  enableWorkflowValidation?: boolean;
};

type TReviewerModalState = {
  issueId: string;
  fromStateId: string;
  toStateId: string;
  reviewers: string[];
  transitionId?: string;
  approvalRequestId?: string;
} | null;

export const WorkItemStateDropdownBase = observer(function WorkItemStateDropdownBase(
  props: TWorkItemStateDropdownBaseProps
) {
  const {
    alwaysAllowStateChange,
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    getStateById,
    hideIcon = false,
    iconSize = "size-4",
    isForWorkItemCreation = false,
    isInitializing = false,
    onChange,
    onClose,
    onDropdownOpen,
    placement,
    projectId,
    renderByDefault = true,
    showDefaultState = true,
    showTooltip = false,
    stateIds,
    tabIndex,
    value,
    issueId,
    enableWorkflowValidation = true,
  } = props;
  // refs
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // popper-js refs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [reviewerModalData, setReviewerModalData] = useState<TReviewerModalState>(null);
  // store hooks
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const {
    getDefaultWorkflow,
    getWorkflowStates,
    getWorkflowTransitions,
    fetchWorkflowStates,
    fetchWorkflowTransitions,
    validateTransition,
    pendingApprovalIssueIds,
    fetchPendingApprovals,
  } = useWorkflow();

  // issues store
  const { issueMap } = useIssues(EIssuesStoreType.PROJECT);
  // const issue = issueId ? issueMap?.[issueId] : undefined;
  const isApprovalPending = issueId ? pendingApprovalIssueIds?.[issueId] : false;

  // console.log("StateDropdownBase Debug:", { issueId, isApprovalPending });

  const statesList = stateIds.map((stateId) => getStateById(stateId)).filter((state) => !!state);
  const defaultState = statesList?.find((state) => state?.default);
  const stateValue = value ? value : showDefaultState ? defaultState?.id : undefined;
  // popper-js init
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: placement ?? "bottom-start",
    modifiers: [
      {
        name: "preventOverflow",
        options: {
          padding: 12,
        },
      },
    ],
  });

  const defaultWorkflow = projectId ? getDefaultWorkflow(projectId) : undefined;
  const workflowStates = defaultWorkflow ? getWorkflowStates(defaultWorkflow.id) : [];
  const workflowTransitions = defaultWorkflow ? getWorkflowTransitions(defaultWorkflow.id) : [];
  const workflowStatesSignature = workflowStates
    .map((state) => `${state.id}:${state.allow_new_issues ? 1 : 0}`)
    .join("|");
  const workflowTransitionsSignature = workflowTransitions
    .map((transition) => `${transition.id}:${transition.from_state}->${transition.to_state}`)
    .join("|");

  // Fetch pending approvals on mount
  useEffect(() => {
    if (workspaceSlug && projectId) {
      fetchPendingApprovals(workspaceSlug.toString(), projectId);
    }
  }, [workspaceSlug, projectId, fetchPendingApprovals]);

  const selectedState = stateValue ? getStateById(stateValue) : undefined;

  // Ensure workflow metadata is available when needed
  useEffect(() => {
    if (!projectId || !workspaceSlug) return;
    if (alwaysAllowStateChange) return;

    if (!defaultWorkflow) return;

    if (isForWorkItemCreation) {
      if (!workflowStates || workflowStates.length === 0) {
        fetchWorkflowStates(workspaceSlug.toString(), projectId, defaultWorkflow.id).catch((error) => {
          console.error("StateDropdown: Error fetching workflow states", error);
        });
      }
      return;
    }

    if (!enableWorkflowValidation || !issueId) return;

    if (!workflowTransitions || workflowTransitions.length === 0) {
      fetchWorkflowTransitions(workspaceSlug.toString(), projectId, defaultWorkflow.id).catch((error) => {
        console.error("StateDropdown: Error fetching workflow transitions", error);
      });
    }
  }, [
    alwaysAllowStateChange,
    enableWorkflowValidation,
    fetchWorkflowStates,
    fetchWorkflowTransitions,
    defaultWorkflow?.id,
    isForWorkItemCreation,
    issueId,
    projectId,
    workspaceSlug,
    workflowStates.length,
    workflowTransitions.length,
  ]);

  const availableStates = useMemo(() => {
    if (alwaysAllowStateChange) return statesList;

    if (isForWorkItemCreation && projectId && workspaceSlug && defaultWorkflow) {
      if (workflowStates && workflowStates.length > 0) {
        const allowedStateIds = new Set(
          workflowStates
            .filter((workflowState) => workflowState.allow_new_issues)
            .map((workflowState) => workflowState.state)
        );
        const filteredStates = statesList.filter((state) => allowedStateIds.has(state.id));
        if (filteredStates.length > 0) {
          return filteredStates;
        }
      }
      return statesList;
    }

    if (!enableWorkflowValidation || !issueId || !projectId || !workspaceSlug || !defaultWorkflow) {
      return statesList;
    }

    if (!workflowTransitions || workflowTransitions.length === 0) return statesList;

    const currentStateId = stateValue;
    if (!currentStateId) return statesList;

    const permittedStateIds = new Set<string>([currentStateId]);
    workflowTransitions
      .filter((transition) => transition.from_state === currentStateId)
      .forEach((transition) => permittedStateIds.add(transition.to_state));

    const filteredStates = statesList.filter((state) => permittedStateIds.has(state.id));
    return filteredStates.length > 0 ? filteredStates : statesList;
  }, [
    alwaysAllowStateChange,
    defaultWorkflow,
    enableWorkflowValidation,
    isForWorkItemCreation,
    issueId,
    projectId,
    stateValue,
    statesList,
    workspaceSlug,
    workflowStatesSignature,
    workflowTransitionsSignature,
  ]);

  const options = useMemo(
    () =>
      availableStates.map((state) => ({
        value: state.id,
        query: `${state.name}`,
        content: (
          <div className="flex items-center gap-2">
            <StateGroupIcon
              stateGroup={state.group ?? "backlog"}
              color={state.color}
              className={cn("flex-shrink-0", iconSize)}
              percentage={state.order}
            />
            <span className="flex-grow truncate text-left">{state.name}</span>
          </div>
        ),
      })),
    [availableStates, iconSize]
  );

  const filteredOptions = useMemo(
    () =>
      query === "" ? options : options.filter((option) => option.query.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  const validateStateTransition = async (toStateId: string) => {
    if (
      alwaysAllowStateChange ||
      !enableWorkflowValidation ||
      !issueId ||
      !workspaceSlug ||
      !projectId ||
      !stateValue ||
      stateValue === toStateId
    ) {
      return { allowed: true, requiresReviewer: false } as const;
    }

    try {
      const validationResult = await validateTransition(workspaceSlug.toString(), projectId, {
        issue_id: issueId,
        from_state_id: stateValue,
        to_state_id: toStateId,
      });

      return {
        allowed: validationResult.allowed,
        requiresReviewer: validationResult.requires_reviewer || false,
        reviewers: validationResult.reviewers || [],
        transitionId: validationResult.transition_id || "",
        reason: validationResult.reason,
      } as const;
    } catch (error) {
      console.warn("Workflow validation error:", error);
      return { allowed: true, requiresReviewer: false } as const;
    }
  };

  const dropdownOnChange = async (val: string) => {
    if (enableWorkflowValidation && issueId && !alwaysAllowStateChange) {
      const validation = await validateStateTransition(val);

      if (!validation.allowed) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "상태 전환 불가",
          message: validation.reason || "워크플로우 규칙에 의해 이 상태로의 전환이 허용되지 않습니다.",
        });
        return;
      }

      if (validation.requiresReviewer && validation.reviewers && validation.reviewers.length > 0 && stateValue) {
        setReviewerModalData({
          issueId,
          fromStateId: stateValue,
          toStateId: val,
          reviewers: validation.reviewers,
          transitionId: validation.transitionId,
        });
        handleClose();
        return;
      }
    }

    onChange(val);
    handleClose();
  };

  const { handleClose, handleKeyDown, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose,
    onOpen: onDropdownOpen,
    query,
    setIsOpen,
    setQuery,
  });

  const comboButton = (
    <>
      {button ? (
        <button
          ref={setReferenceElement}
          type="button"
          className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
          onClick={handleOnClick}
          disabled={disabled}
          tabIndex={tabIndex}
        >
          {button}
        </button>
      ) : (
        <button
          tabIndex={tabIndex}
          ref={setReferenceElement}
          type="button"
          className={cn(
            "clickable block h-full max-w-full outline-none",
            {
              "cursor-not-allowed text-custom-text-200": disabled || isApprovalPending,
              "cursor-pointer": !disabled && !isApprovalPending,
            },
            buttonContainerClassName
          )}
          onClick={handleOnClick}
          disabled={disabled || isApprovalPending}
        >
          <DropdownButton
            className={buttonClassName}
            isActive={isOpen}
            tooltipHeading={t("state")}
            tooltipContent={
              isApprovalPending
                ? "승인 대기 중"
                : selectedState?.name ?? t("state")
            }
            showTooltip={showTooltip || !!isApprovalPending}
            variant={buttonVariant}
            renderToolTipByDefault={renderByDefault}
          >
            {isInitializing ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <>
                {!hideIcon && (
                  <StateGroupIcon
                    stateGroup={selectedState?.group ?? "backlog"}
                    color={selectedState?.color ?? "rgba(var(--color-text-300))"}
                    className={cn("flex-shrink-0", iconSize)}
                    percentage={selectedState?.order}
                  />
                )}
                {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
                  <span className="flex-grow truncate text-left">{selectedState?.name ?? t("state")}</span>
                )}
                {dropdownArrow && (
                  <ChevronDownIcon
                    className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)}
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </DropdownButton>
        </button>
      )}
    </>
  );

  return (
    <>
      <ComboDropDown
        as="div"
        ref={dropdownRef}
        className={cn("h-full", className)}
        value={stateValue}
        onChange={dropdownOnChange}
        disabled={disabled || isApprovalPending}
        onKeyDown={handleKeyDown}
        button={comboButton}
        renderByDefault={renderByDefault}
      >
        {isOpen && (
          <Combobox.Options className="fixed z-10" static>
            <div
              className="my-1 w-48 rounded border-[0.5px] border-custom-border-300 bg-custom-background-100 px-2 py-2.5 text-xs shadow-custom-shadow-rg focus:outline-none"
              ref={setPopperElement}
              style={styles.popper}
              {...attributes.popper}
            >
              <div className="flex items-center gap-1.5 rounded border border-custom-border-100 bg-custom-background-90 px-2">
                <Search className="h-3.5 w-3.5 text-custom-text-400" strokeWidth={1.5} />
                <Combobox.Input
                  as="input"
                  ref={inputRef}
                  className="w-full bg-transparent py-1 text-xs text-custom-text-200 placeholder:text-custom-text-400 focus:outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common.search.label")}
                  displayValue={(assigned: any) => assigned?.name}
                  onKeyDown={searchInputKeyDown}
                />
              </div>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <StateOption
                      {...props}
                      key={option.value}
                      option={option}
                      selectedValue={value}
                      className="flex w-full cursor-pointer select-none items-center justify-between gap-2 truncate rounded px-1 py-1.5"
                    />
                  ))
                ) : (
                  <p className="px-1.5 py-1 italic text-custom-text-400">{t("no_matching_results")}</p>
                )}
              </div>
            </div>
          </Combobox.Options>
        )}
      </ComboDropDown>

      <WorkflowReviewerModal
        isOpen={!!reviewerModalData}
        onClose={() => setReviewerModalData(null)}
        transitionData={reviewerModalData}
        projectId={projectId}
        onApprove={() => {
          setToast({
            type: TOAST_TYPE.INFO,
            title: "승인 요청 완료",
            message: "워크플로우 승인 모달에서 요청을 확인하세요.",
          });
        }}
      />
    </>
  );
});
