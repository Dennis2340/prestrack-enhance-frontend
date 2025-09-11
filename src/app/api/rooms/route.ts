import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const onlineGuestsOnly = searchParams.get("onlineGuestsOnly") === "true";
    const onlineWindowMsParam = searchParams.get("onlineWindowMs");
    const onlineWindowMs = onlineWindowMsParam ? Number(onlineWindowMsParam) : 120000; // default 2 minutes
    const cutoff = new Date(Date.now() - (isNaN(onlineWindowMs) ? 120000 : onlineWindowMs));
    const includeMedical = searchParams.get("includeMedical") === "true";
    const includeVisits = searchParams.get("includeVisits") === "true";
    const includeReminders = searchParams.get("includeReminders") === "true";

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 });
    }

    const rooms = await db.room.findMany({
      where: {
        status: "active",
        businessId,
        ...(onlineGuestsOnly
          ? {
              messages: {
                some: {
                  senderType: "guest",
                  timestamp: { gte: cutoff },
                },
              },
            }
          : {}),
      },
      include: {
        messages: {
          orderBy: { timestamp: "desc" },
          take: 5,
          select: {
            id: true,
            content: true,
            timestamp: true,
            sender: { select: { id: true, name: true } },
            senderType: true,
            taggedAgents: { select: { id: true, name: true } },
          },
        },
        guest: { select: { id: true, name: true, email: true } },
        activeAgents: { select: { id: true, name: true, email: true } },
      },
    });

    // Optional enrichment
    if (!includeMedical && !includeVisits && !includeReminders) {
      return NextResponse.json({ rooms }, { status: 200 });
    }

    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const guestId = room.guest?.id;
        if (!guestId) return room;

        try {
          const [medicalData, visits, reminders] = await Promise.all([
            includeMedical
              ? db.medicalContext.findUnique({
                  where: { guestId },
                  select: {
                    pregnancyStatus: true,
                    conditions: true,
                    medications: true,
                    allergies: true,
                    // bloodType not in schema by default; keeping optional mapping compatibility
                  },
                })
              : Promise.resolve(undefined),
            includeVisits
              ? db.visitation.findMany({
                  where: { guestId },
                  orderBy: { scheduledTime: "asc" },
                  select: {
                    id: true,
                    scheduledTime: true,
                    status: true,
                    notes: true,
                    createdAt: true,
                  },
                })
              : Promise.resolve(undefined),
            includeReminders
              ? db.reminder.findMany({
                  where: { guestId },
                  orderBy: { scheduledTime: "asc" },
                  select: {
                    id: true,
                    message: true,
                    scheduledTime: true,
                    createdAt: true,
                  },
                })
              : Promise.resolve(undefined),
          ]);

          return {
            ...room,
            ...(medicalData ? { medicalData } : {}),
            ...(visits ? { visits } : {}),
            ...(reminders ? { reminders } : {}),
          };
        } catch (_e) {
          // If enrichment fails, return room as-is
          return room;
        }
      })
    );

    return NextResponse.json({ rooms: enriched }, { status: 200 });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}