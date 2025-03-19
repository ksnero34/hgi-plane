import { useContext, useEffect, useState } from "react";
// store
import { StoreContext } from "@/lib/store-provider";
import { IUserStore } from "@/store/user.store";
import { useInstance } from "./use-instance";

export const useUser = (): IUserStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useUser must be used within StoreProvider");
  return context.user;
};

export const useAuth = () => {
  const user = useUser();
  const instance = useInstance();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 인스턴스 관리자 데이터 초기화
  useEffect(() => {
    const initializeData = async () => {
      try {
        // 인스턴스 관리자 목록 불러오기
        console.log("Fetching instance admins...");
        await instance.fetchInstanceAdmins();
        setIsInitialized(true);
      } catch (error) {
        console.error("Error fetching instance admins:", error);
        setIsInitialized(true);
      }
    };
    
    if (!isInitialized && user.currentUser?.id) {
      initializeData();
    }
  }, [instance, user.currentUser?.id, isInitialized]);
  
  // 콘솔에 인스턴스 관리자 데이터 로깅
  useEffect(() => {
    if (instance.instanceAdmins && user.currentUser) {
      console.log("Instance admins loaded:", {
        adminCount: instance.instanceAdmins.length,
        currentUserId: user.currentUser.id
      });
    }
  }, [instance.instanceAdmins, user.currentUser]);
  
  // 인스턴스 관리자 확인
  const isInstanceAdmin = Boolean(
    instance.instanceAdmins?.some(
      (admin) => admin.user === user.currentUser?.id && admin.role >= 15
    )
  );
  
  // 관리자 확인
  const userIsAdmin = Boolean(user.currentUser?.is_admin);
  
  // 최종 관리자 상태
  const isAdmin = userIsAdmin || isInstanceAdmin;
  
  // 현재 사용자의 ID 및 관리자 상태 로깅
  useEffect(() => {
    if (user.currentUser && !user.isLoading && isInitialized) {
      console.log("Final auth status:", {
        id: user.currentUser.id,
        email: user.currentUser.email,
        is_admin: user.currentUser?.is_admin,
        userIsAdmin: userIsAdmin,
        isInstanceAdmin: isInstanceAdmin,
        finalIsAdmin: isAdmin,
        instanceAdmins: instance.instanceAdmins,
      });
    }
  }, [user.currentUser, user.isLoading, isInitialized, userIsAdmin, isInstanceAdmin, isAdmin, instance.instanceAdmins]);
  
  return {
    isLoading: user.isLoading || !isInitialized,
    isLoggedIn: user.isUserLoggedIn,
    isAdmin: isAdmin,
    currentUser: user.currentUser,
  };
};
