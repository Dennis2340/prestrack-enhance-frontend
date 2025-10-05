import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patientId = String((await params).id);
    const body = await req.json().catch(() => ({}));
    const lmp = body?.lmp ? new Date(body.lmp) : null;
    const gravida = body?.gravida != null ? Number(body.gravida) : null;
    const para = body?.para != null ? Number(body.para) : null;

    // Compute EDD by Naegele's rule (LMP + 280 days) if LMP provided
    const edd = lmp ? new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000) : null;

    // Ensure patient exists
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Deactivate other pregnancies if we will create a new active one
    let pregn = await prisma.pregnancy.findFirst({ where: { patientId, isActive: true } });
    if (pregn) {
      pregn = await prisma.pregnancy.update({
        where: { id: pregn.id },
        data: { lmp: lmp ?? undefined, edd: edd ?? undefined, gravida: gravida ?? undefined, para: para ?? undefined },
      });
    } else {
      pregn = await prisma.pregnancy.create({
        data: { patientId, isActive: true, lmp: lmp ?? undefined, edd: edd ?? undefined, gravida: gravida ?? undefined, para: para ?? undefined },
      });
    }

    return NextResponse.json({ ok: true, pregnancyId: pregn.id, edd: edd?.toISOString() || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 400 });
  }
}
