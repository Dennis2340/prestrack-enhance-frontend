/* eslint-disable @typescript-eslint/no-unused-vars */
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const agents = await db.user.findMany({
      where: {
        role: "agent",
      },
    });

    return NextResponse.json({
      agents,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
  }
}
