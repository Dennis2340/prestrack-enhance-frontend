/* eslint-disable @typescript-eslint/no-unused-vars */
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json("Invalid agentId", { status: 400 });
    }

    const notifications = await db.notification.findMany();
    return NextResponse.json({ notifications });
  } catch (error) {
    console.log("ERROR GETTING NOTIFICATIONS", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const {
      notificationsId,
      agentId,
    }: { notificationsId: string[]; agentId: string } = await req.json();

    if (!notificationsId?.length || !agentId) {
      return NextResponse.json(
        { error: "Invalid notificationId or agentId" },
        { status: 400 }
      );
    }

    const markAsRead = await db.notification.updateMany({
      where: {
        id: { in: notificationsId },
        NOT: {
          read: {
            has: agentId,
          },
        },
      },
      data: {
        read: {
          push: agentId,
        },
      },
    });

    if (markAsRead.count === 0) {
      return NextResponse.json(
        { error: "No notifications were updated (possibly already read)" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Notifications marked as read successfully",
    });
  } catch (error) {
    console.log("ERROR POSTING MARK AS READ", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
