import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function POST(req) {
  try {
    // authenticate user
    const auth = await getAuthUserFromCookie(req);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = auth.payload;

    // fetch user record
    const userRecord = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // only banned users can submit an appeal
    if (!userRecord.isBanned) {
      return NextResponse.json({ error: "You are not banned" }, { status: 400 });
    }

    // parse body
    const body = await req.json();
    const { reason } = body;
    if (typeof reason !== "string") {
      return NextResponse.json({ error: "Reason must be a string" }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 });

    // check if user already has a pending appeal
    const existingAppeal = await prisma.appeal.findFirst({
      where: { userId: payload.userId, status: "PENDING" },
    });
    if (existingAppeal) {
      return NextResponse.json({ error: "You already have a pending appeal" }, { status: 400 });
    }

    // create appeal
    const appeal = await prisma.appeal.create({
      data: {
        userId: payload.userId,
        reason,
      },
    });
    await invalidateRouteCache();

    return NextResponse.json(appeal, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
