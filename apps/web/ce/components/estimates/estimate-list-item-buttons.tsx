import { observer } from "mobx-react";
import { Pen, Trash } from "lucide-react";
import { PROJECT_SETTINGS_TRACKER_ELEMENTS } from "@plane/constants";
import { Tooltip } from "@plane/propel/tooltip";
// components
import { useProjectEstimates } from "@/hooks/store/estimates";

type TEstimateListItem = {
  estimateId: string;
  isAdmin: boolean;
  isEstimateEnabled: boolean;
  isEditable: boolean;
  onEditClick?: (estimateId: string) => void;
  onDeleteClick?: (estimateId: string) => void;
};

export const EstimateListItemButtons = observer(function EstimateListItemButtons(props: TEstimateListItem) {
  const { estimateId, isAdmin, isEditable, onEditClick, onDeleteClick } = props;
  const { estimateById } = useProjectEstimates();
  const currentEstimate = estimateById(estimateId);

  if (!isAdmin || !isEditable) return <></>;
  return (
    <div className="relative flex items-center gap-1">
      <Tooltip tooltipContent="Edit estimate">
        <button
          className="relative flex-shrink-0 w-6 h-6 flex justify-center items-center rounded cursor-pointer transition-colors overflow-hidden hover:bg-custom-background-80"
          onClick={() => onEditClick && onEditClick(estimateId)}
          data-ph-element={PROJECT_SETTINGS_TRACKER_ELEMENTS.ESTIMATES_LIST_ITEM}
        >
          <Pen size={12} />
        </button>
      </Tooltip>
      <Tooltip tooltipContent="Delete estimate">
        <button
          className="relative flex-shrink-0 w-6 h-6 flex justify-center items-center rounded cursor-pointer transition-colors overflow-hidden hover:bg-custom-background-80"
          onClick={() => onDeleteClick && onDeleteClick(estimateId)}
          data-ph-element={PROJECT_SETTINGS_TRACKER_ELEMENTS.ESTIMATES_LIST_ITEM}
        >
          <Trash size={12} />
        </button>
      </Tooltip>
    </div>
  );
});
