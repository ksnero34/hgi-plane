import { FC } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ContrastIcon,
  LayersIcon,
  Link2,
  Paperclip,
  Signal,
  Tag,
  Triangle,
  Users,
  Settings,
} from "lucide-react";
// types
import { IGroupByColumn, IIssueDisplayProperties, TSpreadsheetColumn } from "@plane/types";
import { DiceIcon, DoubleCircleIcon, ISvgIcons } from "@plane/ui";
// components
import {
  SpreadsheetAssigneeColumn,
  SpreadsheetAttachmentColumn,
  SpreadsheetCreatedOnColumn,
  SpreadsheetDueDateColumn,
  SpreadsheetEstimateColumn,
  SpreadsheetLabelColumn,
  SpreadsheetModuleColumn,
  SpreadsheetCycleColumn,
  SpreadsheetLinkColumn,
  SpreadsheetPriorityColumn,
  SpreadsheetStartDateColumn,
  SpreadsheetStateColumn,
  SpreadsheetSubIssueColumn,
  SpreadsheetUpdatedOnColumn,
  AllCustomFieldsColumn,
} from "@/components/issues/issue-layouts/spreadsheet/columns";

export const getTeamProjectColumns = (): IGroupByColumn[] | undefined => undefined;

export const SpreadSheetPropertyIconMap: Record<string, FC<ISvgIcons>> = {
  Users: Users,
  CalenderDays: CalendarDays,
  CalenderCheck2: CalendarCheck2,
  Triangle: Triangle,
  Tag: Tag,
  DiceIcon: DiceIcon,
  ContrastIcon: ContrastIcon,
  Signal: Signal,
  CalendarClock: CalendarClock,
  DoubleCircleIcon: DoubleCircleIcon,
  Link2: Link2,
  Paperclip: Paperclip,
  LayersIcon: LayersIcon,
  Settings: Settings,
};

export const SPREADSHEET_COLUMNS: { [key in keyof IIssueDisplayProperties]: TSpreadsheetColumn } = {
  assignee: SpreadsheetAssigneeColumn,
  created_on: SpreadsheetCreatedOnColumn,
  due_date: SpreadsheetDueDateColumn,
  estimate: SpreadsheetEstimateColumn,
  labels: SpreadsheetLabelColumn,
  modules: SpreadsheetModuleColumn,
  cycle: SpreadsheetCycleColumn,
  link: SpreadsheetLinkColumn,
  priority: SpreadsheetPriorityColumn,
  start_date: SpreadsheetStartDateColumn,
  state: SpreadsheetStateColumn,
  sub_issue_count: SpreadsheetSubIssueColumn,
  updated_on: SpreadsheetUpdatedOnColumn,
  attachment_count: SpreadsheetAttachmentColumn,
  custom_fields: AllCustomFieldsColumn,
};
