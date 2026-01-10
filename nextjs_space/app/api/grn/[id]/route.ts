import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Fetch a single GRN by ID
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        items: true,
      },
    });

    if (!grn) {
      return NextResponse.json(
        { error: "GRN not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(grn);
  } catch (error) {
    console.error("Error fetching GRN:", error);
    return NextResponse.json(
      { error: "Failed to fetch GRN" },
      { status: 500 }
    );
  }
}
