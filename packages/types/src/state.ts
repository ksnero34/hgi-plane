export type TStateGroups = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

export type IState = {
  readonly id: string;
  color: string;
  default: boolean;
  description: string;
  group: TStateGroups;
  name: string;
  project_id: string;
  sequence: number;
  workspace_id: string;
  order: number;
};

export type IStateLite = {
  color: string;
  group: TStateGroups;
  id: string;
  name: string;
};

export type IStateResponse = {
  [key: string]: IState[];
};

export type TStateOperationsCallbacks = {
  createState: (data: Partial<IState>) => Promise<IState>;
  updateState: (stateId: string, data: Partial<IState>) => Promise<IState | undefined>;
  deleteState: (stateId: string) => Promise<void>;
  moveStatePosition: (stateId: string, data: Partial<IState>) => Promise<void>;
  markStateAsDefault: (stateId: string) => Promise<void>;
};
