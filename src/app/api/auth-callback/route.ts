import { NextResponse } from "next/server";
import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function GET() {
  try {
    // Get the session user from Kinde.
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id || !user?.email) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID;
    if (!businessId) {
      return new NextResponse(
        JSON.stringify({ error: "Business ID not configured" }),
        { status: 500 }
      );
    }

    // Check if the user exists by email.
    let dbUser = await db.user.findUnique({
      where: { email: user.email },
    });

    // If the user exists but is not an admin, reject the request
    if (dbUser && dbUser.role !== "admin") {
      return new NextResponse(
        JSON.stringify({ error: "This endpoint is for admins only" }),
        { status: 403 } // Forbidden
      );
    }

    // If the user does not exist, create a new admin entry with businessId
    if (!dbUser) {
      dbUser = await db.user.create({
        data: {
          name: `${user.given_name || ""} ${user.family_name || ""}`.trim() || user.email.split("@")[0],
          email: user.email,
          role: "admin", // Explicitly set as admin
          businessId,    // Add businessId for admin users
        },
      });
    } 
    // If the user exists and is an admin, update businessId if it doesn’t match
    else if (dbUser.role === "admin" && dbUser.businessId !== businessId) {
      dbUser = await db.user.update({
        where: { email: user.email },
        data: { businessId },
      });
    }

    return new NextResponse(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}