import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ exists: false });
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!customer });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
