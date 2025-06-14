import React from "react";
import AdminDashboard from "@/components/AdminDashboard";
import AdminNavbar from "@/components/AdminNavbar";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";

const Page = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user) {
    redirect("/auth-callback");
  }

  return (
    <>
      <AdminNavbar userData={user} />
      <AdminDashboard />
    </>
  );
};

export default Page;
