"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
// hooks
import { useInstance, useAuth, useUser } from "@/hooks/store";
// components
import { GeneralConfigurationForm } from "./form";

function GeneralPage() {
  const { instance, instanceAdmins, fetchInstanceAdmins, fetchInstanceInfo } = useInstance();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { currentUser } = useUser();
  const pathname = usePathname();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 직접 인스턴스 관리자 API 호출로 인증 체크
  useEffect(() => {
    // 페이지 로드 즉시 직접 API 호출하여 401 에러 발생시키기
    console.log("General 페이지: 직접 API 호출로 인증 체크");
    axios.get("/api/instances/admins/", { withCredentials: true })
      .then(response => {
        console.log("General 페이지: 관리자 API 호출 성공", response.data);
      })
      .catch(error => {
        console.log("General 페이지: 관리자 API 호출 오류", error);
        // 401 에러 발생 시 리다이렉션
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          const normalizedPath = currentPath.replace(/^\/god-mode/, '');
          window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
        }
      });
  }, []);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("General 페이지: 데이터 로딩 시작");
        await fetchInstanceAdmins();
        console.log("General 페이지: instanceAdmins 로드 완료", instanceAdmins);
        console.log("General 페이지: currentUser", currentUser);
        setIsDataLoaded(true);
      } catch (error) {
        console.error("General 페이지: 데이터 로드 오류", error);
      }
    };

    if (!authLoading && isAdmin && !isDataLoaded) {
      loadData();
    }
  }, [authLoading, isAdmin, instanceAdmins, currentUser, fetchInstanceAdmins, isDataLoaded]);

  // 경로에서 '/god-mode' 접두사를 제거하는 함수
  const getNormalizedPath = (path: string) => path.replace(/^\/god-mode/, '');

  // 로딩 중일 때는 아무것도 표시하지 않음
  if (authLoading || !isDataLoaded) {
    console.log("General 페이지: 로딩 중", { authLoading, isDataLoaded });
    return null;
  }

  return (
    <>
      <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
        <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
          <div className="text-xl font-medium text-custom-text-100">General settings</div>
          <div className="text-sm font-normal text-custom-text-300">
            Change the name of your instance and instance admin e-mail addresses. Enable or disable telemetry in your
            instance.
          </div>
        </div>
        <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
          {instance && instanceAdmins && (
            <GeneralConfigurationForm instance={instance} instanceAdmins={instanceAdmins} />
          )}
        </div>
      </div>
    </>
  );
}

export default observer(GeneralPage);
