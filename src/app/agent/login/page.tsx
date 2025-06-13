"use client";
import React, { useEffect } from "react";
import AgentLoginForm from "@/components/AgentLoginForm";
import AgentNavbar from "@/components/AgentNavbar";
import { BUSINESS_CONFIG } from "../../../../config";
import { useRouter } from "next/navigation";

const AgentLogin = () => {
  const router = useRouter();
  useEffect(() => {
    const storedAgent = localStorage.getItem("currentAgent");
    if (storedAgent) {
      try {
        router.push("/agent");
      } catch (error) {
        console.error("Error parsing currentAgent:", error);
        router.push("/agent/login");
      }
    } else {
      router.push("/agent/login");
    }
  }, [router]);

  return (
    <>
      <AgentNavbar />
      <div className={` mx-32 bg-${BUSINESS_CONFIG.theme.primaryColor}-50`}>
        <AgentLoginForm businessId={BUSINESS_CONFIG.businessId} />
      </div>
    </>
  );
};

export default AgentLogin;
