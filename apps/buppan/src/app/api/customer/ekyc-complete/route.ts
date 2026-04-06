import { auth } from "@/auth";
import { prisma } from "@/lib/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    const customer = await prisma.customer.findFirst({
      where: { userId: session.user.id },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ekycCompleted: true,
        ekycCompletedAt: new Date(),
        ekycSessionId: sessionId || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("eKYC complete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
