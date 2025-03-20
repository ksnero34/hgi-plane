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
        adminCount: Array.isArray(instance.instanceAdmins) ? instance.instanceAdmins.length : '배열이 아님',
        currentUserId: user.currentUser.id
      });
    }
  }, [instance.instanceAdmins, user.currentUser]);
  
  // 인스턴스 관리자 확인
  const isInstanceAdmin = Boolean(
    instance.instanceAdmins && 
    Array.isArray(instance.instanceAdmins) && 
    instance.instanceAdmins.some(
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
  
  // 권한이 없는 경우 자동 리다이렉션
  useEffect(() => {
    if (!user.isLoading && isInitialized && user.currentUser && !isAdmin) {
      console.log("권한이 없는 사용자 감지. 리다이렉션 수행...");
      const currentPath = window.location.pathname;
      const normalizedPath = currentPath.replace(/^\/god-mode/, '');
      window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
    }
  }, [user.isLoading, isInitialized, user.currentUser, isAdmin]);
  
  return {
    isLoading: user.isLoading || !isInitialized,
    isLoggedIn: user.isUserLoggedIn,
    isAdmin: isAdmin,
    currentUser: user.currentUser,
  };
};
