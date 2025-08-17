import { NextResponse } from "next/server";
import { db } from "@/db";
import { BUSINESS_CONFIG } from "../../../../../config";

// Online definition (temporary until sockets):
// - Room is active AND
// - Guest exists AND
// - Optional: has message in the last `thresholdMinutes` minutes (default 10)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdMinutes = parseInt(searchParams.get("thresholdMinutes") || "10", 10);
    const since = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const rooms = await db.room.findMany({
      where: {
        businessId: BUSINESS_CONFIG.businessId,
        status: "active",
        guestId: { not: null },
      },
      include: {
        guest: true,
        messages: {
          where: { timestamp: { gte: since } },
          select: { id: true },
          take: 1,
        },
      },
    });

    const onlinePatients = rooms
      .filter((r) => !!r.guest)
      .map((r) => ({
        roomId: r.id,
        guestId: r.guest!.id,
        name: r.guest!.name,
        email: r.guest!.email,
        recentlyActive: r.messages.length > 0,
      }));

    return NextResponse.json({
      count: onlinePatients.length,
      thresholdMinutes,
      patients: onlinePatients,
    });
  } catch (err) {
    console.error("online-patients error", err);
    return NextResponse.json({ error: "Failed to load online patients" }, { status: 500 });
  }
}
