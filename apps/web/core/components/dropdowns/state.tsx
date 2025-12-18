import { useRef, useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { usePopper } from "react-popper";
import { ChevronDown, Search } from "lucide-react";
import { Combobox } from "@headlessui/react";
import { useTranslation } from "@plane/i18n";
// ui
import { ComboDropDown, Spinner } from "@plane/ui";
import { StateGroupIcon } from "@plane/propel/icons";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useWorkflow } from "@/hooks/store/use-workflow";
// ui
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useDropdown } from "@/hooks/use-dropdown";
// Plane-web
import { StateOption } from "@/plane-web/components/workflow";
// components
import { DropdownButton } from "./buttons";
import { WorkflowReviewerModal } from "@/components/project/settings/workflow-reviewer-modal";
// constants
import { BUTTON_VARIANTS_WITH_TEXT } from "./constants";
// types
import type { TDropdownProps } from "./types";

type Props = TDropdownProps & {
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  onChange: (val: string) => void;
  onClose?: () => void;
  projectId: string | undefined;
  showDefaultState?: boolean;
  value: string | undefined | null;
  renderByDefault?: boolean;
  stateIds?: string[];
  filterAvailableStateIds?: boolean;
  isForWorkItemCreation?: boolean;
  alwaysAllowStateChange?: boolean;
  iconSize?: string;
  issueId?: string; // for workflow validation
  enableWorkflowValidation?: boolean; // enable/disable workflow validation
};

export const StateDropdown: React.FC<Props> = observer((props) => {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    hideIcon = false,
    onChange,
    onClose,
    placement,
    projectId,
    showDefaultState = true,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
    stateIds,
    iconSize = "size-4",
    issueId,
    enableWorkflowValidation = true,
  } = props;
  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [stateLoader, setStateLoader] = useState(false);
  const [workflowStatesLoaded, setWorkflowStatesLoaded] = useState(false);
  const [reviewerModalData, setReviewerModalData] = useState<{
    issueId: string;
    fromStateId: string;
    toStateId: string;
    reviewers: string[];
    transitionId?: string;
    approvalRequestId?: string;
  } | null>(null);
  // refs
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // popper-js refs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
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
  // store hooks
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { fetchProjectStates, getProjectStates, getStateById } = useProjectState();
  const {
    validateTransition,
    requestApproval,
    getDefaultWorkflow,
    getWorkflowTransitions,
    getWorkflowStates,
    fetchWorkflowStates,
    fetchWorkflowTransitions,
    workflowStates: allWorkflowStates,
  } = useWorkflow();
  const statesList = stateIds
    ? stateIds.map((stateId) => getStateById(stateId)).filter((state) => !!state)
    : getProjectStates(projectId);
  const defaultState = statesList?.find((state) => state?.default);
  const stateValue = !!value ? value : showDefaultState ? defaultState?.id : undefined;

  // Note: Workflow data is now preloaded at the page level (ProjectLayoutRoot)
  // to ensure it's available before StateDropdown components render

  // Load workflow states and transitions when needed
  useEffect(() => {
    if (projectId && workspaceSlug) {
      const defaultWorkflow = getDefaultWorkflow(projectId);
      if (defaultWorkflow) {
        // For new issue creation, load workflow states
        if (props.isForWorkItemCreation) {
          const workflowStates = getWorkflowStates(defaultWorkflow.id);
          if (!workflowStates || workflowStates.length === 0) {
            fetchWorkflowStates(workspaceSlug.toString(), projectId, defaultWorkflow.id)
              .then(() => {
                setWorkflowStatesLoaded(true);
              })
              .catch((error) => {
                console.error("StateDropdown: Error fetching workflow states", error);
              });
          }
        }
        // For existing issues, load workflow transitions
        else if (enableWorkflowValidation && issueId) {
          const transitions = getWorkflowTransitions(defaultWorkflow.id);
          if (!transitions || transitions.length === 0) {
            fetchWorkflowTransitions(workspaceSlug.toString(), projectId, defaultWorkflow.id)
              .then(() => {
                setWorkflowStatesLoaded(true);
              })
              .catch((error) => {
                console.error("StateDropdown: Error fetching workflow transitions", error);
              });
          }
        }
      }
    }
  }, [
    props.isForWorkItemCreation,
    projectId,
    workspaceSlug,
    issueId,
    enableWorkflowValidation,
    getDefaultWorkflow,
    getWorkflowStates,
    getWorkflowTransitions,
    fetchWorkflowStates,
    fetchWorkflowTransitions,
  ]);

  // Get available states based on workflow rules and new issue creation settings
  const getAvailableStates = useMemo(() => {
    // If this is for new issue creation and we have project + workspace context
    if (props.isForWorkItemCreation && projectId && workspaceSlug) {
      // Get default workflow for the project
      const defaultWorkflow = getDefaultWorkflow(projectId);

      if (defaultWorkflow) {
        // Get workflow states
        const workflowStates = getWorkflowStates(defaultWorkflow.id);

        if (workflowStates && workflowStates.length > 0) {
          // Filter states that allow new issues
          const allowedStateIds = workflowStates
            .filter((workflowState) => workflowState.allow_new_issues)
            .map((workflowState) => workflowState.state);

          // Filter project states to only include those allowed for new issues
          const filteredStates = statesList?.filter((state) => allowedStateIds.indexOf(state?.id ?? "") !== -1) || [];

          if (filteredStates.length > 0) {
            return filteredStates;
          }
        }
      }
      // Fallback to all states if no workflow restrictions found
      return statesList;
    }

    // For existing issues with workflow validation
    if (!enableWorkflowValidation || !issueId || !projectId || !workspaceSlug) {
      // console.log("Workflow validation disabled or missing required data");
      return statesList; // Return all states if workflow validation is disabled
    }

    // Get default workflow for the project
    const defaultWorkflow = getDefaultWorkflow(projectId);
    if (!defaultWorkflow) {
      // console.log("No default workflow found for project:", projectId);
      return statesList; // Return all states if no workflow is found
    }

    // Get workflow transitions
    const transitions = getWorkflowTransitions(defaultWorkflow.id);
    // console.log("StateDropdown: Workflow transitions for update", transitions);
    if (!transitions || transitions.length === 0) {
      // console.log("StateDropdown: No transitions found");
      return statesList; // Return all states if no transitions are found
    }

    // Filter states that can be transitioned to from current state
    const currentStateId = stateValue;
    // console.log("StateDropdown: Current state ID for update", currentStateId);
    if (!currentStateId) {
      // console.log("StateDropdown: No current state ID");
      return statesList; // Return all states if no current state
    }

    // Find transitions from current state
    const availableTransitions = transitions.filter((transition) => transition.from_state === currentStateId);
    // console.log("StateDropdown: Available transitions from current state", availableTransitions);

    // Extract target state IDs
    const availableStateIds = new Set([
      currentStateId, // Always include current state
      ...availableTransitions.map((transition) => transition.to_state),
    ]);
    // console.log("StateDropdown: Available state IDs for update", Array.from(availableStateIds));

    // Filter states list to only include available states
    const filteredStates = statesList?.filter((state) => availableStateIds.has(state?.id ?? "")) || [];
    // console.log("StateDropdown: Filtered states for update", filteredStates);

    return filteredStates;
  }, [
    props.isForWorkItemCreation,
    enableWorkflowValidation,
    issueId,
    projectId,
    workspaceSlug,
    statesList,
    stateValue,
    getDefaultWorkflow,
    getWorkflowTransitions,
    getWorkflowStates,
    allWorkflowStates, // 워크플로우 상태가 변경될 때 재계산
    workflowStatesLoaded, // 워크플로우 상태 로드 완료시 재계산
  ]);

  // Workflow validation logic
  const validateStateTransition = async (toStateId: string) => {
    if (!enableWorkflowValidation || !issueId || !workspaceSlug || !projectId || !stateValue) {
      return { allowed: true, requiresReviewer: false };
    }

    if (stateValue === toStateId) {
      return { allowed: true, requiresReviewer: false }; // Same state is always allowed
    }

    try {
      const validationResult = await validateTransition(workspaceSlug as string, projectId, {
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
      };
    } catch (error) {
      console.warn("Workflow validation error:", error);
      return { allowed: true, requiresReviewer: false }; // Allow on error to prevent blocking
    }
  };

  const options = getAvailableStates?.map((state) => ({
    value: state?.id,
    query: `${state?.name}`,
    content: (
      <div className="flex items-center gap-2">
        <StateGroupIcon
          stateGroup={state?.group ?? "backlog"}
          color={state?.color}
          className={cn("flex-shrink-0", iconSize)}
          percentage={state?.order}
        />
        <span className="flex-grow truncate text-left">{state?.name}</span>
      </div>
    ),
    isDisabled: enableWorkflowValidation && issueId && stateValue !== state?.id, // We'll validate on click
  }));

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const selectedState = stateValue ? getStateById(stateValue) : undefined;

  const onOpen = async () => {
    if (!statesList && workspaceSlug && projectId) {
      setStateLoader(true);
      await fetchProjectStates(workspaceSlug.toString(), projectId);
      setStateLoader(false);
    }
  };

  const { handleClose, handleKeyDown, handleOnClick, searchInputKeyDown } = useDropdown({
    dropdownRef,
    inputRef,
    isOpen,
    onClose,
    onOpen,
    query,
    setIsOpen,
    setQuery,
  });

  const dropdownOnChange = async (val: string) => {
    // Workflow validation before allowing state change
    if (enableWorkflowValidation && issueId) {
      const validation = await validateStateTransition(val);

      if (!validation.allowed) {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "상태 전환 불가",
          message: validation.reason || "워크플로우 규칙에 의해 이 상태로의 전환이 허용되지 않습니다.",
        });
        return;
      }

      // If reviewer is required, show modal without creating approval request yet
      if (validation.requiresReviewer && validation.reviewers && validation.reviewers.length > 0) {
        // Show reviewer modal - let the modal handle approval request creation
        setReviewerModalData({
          issueId,
          fromStateId: stateValue!,
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
              "cursor-not-allowed text-custom-text-200": disabled,
              "cursor-pointer": !disabled,
            },
            buttonContainerClassName
          )}
          onClick={handleOnClick}
          disabled={disabled}
        >
          <DropdownButton
            className={buttonClassName}
            isActive={isOpen}
            tooltipHeading={t("state")}
            tooltipContent={selectedState?.name ?? t("state")}
            showTooltip={showTooltip}
            variant={buttonVariant}
            renderToolTipByDefault={renderByDefault}
          >
            {stateLoader ? (
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
                  <ChevronDown className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
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
        disabled={disabled}
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
                {filteredOptions ? (
                  filteredOptions.length > 0 ? (
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
                  )
                ) : (
                  <p className="px-1.5 py-1 italic text-custom-text-400">{t("loading")}</p>
                )}
              </div>
            </div>
          </Combobox.Options>
        )}
      </ComboDropDown>

      {/* Workflow Reviewer Modal */}
      <WorkflowReviewerModal
        isOpen={!!reviewerModalData}
        onClose={() => setReviewerModalData(null)}
        transitionData={reviewerModalData}
        projectId={projectId}
        onApprove={() => {
          // Don't change state immediately after approval request
          // State will be changed only after actual approval through the approval modal
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
