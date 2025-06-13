import React from "react";
import AdminDashboard from "@/components/AdminDashboard";
import AdminNavbar from "@/components/AdminNavbar";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const Page = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  return (
    <>
      <AdminNavbar userData={user} />
      <AdminDashboard />
    </>
  );
};

export default Page;
