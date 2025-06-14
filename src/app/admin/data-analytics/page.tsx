import React from "react";
import DataAnalyticsPage from "@/components/data-analytics/DataAnalyticsPage"; // Adjust path if needed
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
      <DataAnalyticsPage />
    </>
  );
};

export default Page;