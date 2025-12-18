import { makeAutoObservable } from "mobx";
import type { IInstanceMember } from "@plane/types";
import type { IMemberRootStore } from ".";
import { CoreRootStore } from "../root.store";
import { InstanceService } from "@/services/instance.service";

export interface IInstanceMemberStore {
  // observables
  instanceMemberMap: Record<string, IInstanceMember>;
  instanceMemberIds: string[] | null;
  // computed actions
  getInstanceMemberIds: () => string[];
  getInstanceMemberDetails: (userId: string) => IInstanceMember | undefined;
  // fetch actions
  fetchInstanceMembers: () => Promise<void>;
}

export class InstanceMemberStore implements IInstanceMemberStore {
  // observables
  instanceMemberMap: Record<string, IInstanceMember> = {};
  instanceMemberIds: string[] | null = null;
  // stores
  memberRoot: IMemberRootStore;
  // services
  instanceService;

  constructor(_memberRoot: IMemberRootStore, _rootStore: CoreRootStore) {
    makeAutoObservable(this);
    this.memberRoot = _memberRoot;
    this.instanceService = new InstanceService();
  }

  /**
   * @description get all instance member ids
   */
  getInstanceMemberIds = () => Object.keys(this.instanceMemberMap);

  /**
   * @description get instance member details from userId
   * @param userId
   */
  getInstanceMemberDetails = (userId: string) => this.instanceMemberMap?.[userId] ?? undefined;

  /**
   * @description fetch all instance members
   */
  fetchInstanceMembers = async () => {
    try {
      const response = await this.instanceService.getInstanceMembers();

      // Update instance member map
      response.forEach((member: IInstanceMember) => {
        this.instanceMemberMap[member.id] = member;
      });

      // Update instance member ids
      this.instanceMemberIds = response.map((member: IInstanceMember) => member.id);
    } catch (error) {
      console.error("Failed to fetch instance members:", error);
      this.instanceMemberIds = null;
    }
  };
}
