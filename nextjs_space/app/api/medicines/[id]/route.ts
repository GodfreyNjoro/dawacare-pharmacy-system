export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const medicine = await prisma.medicine.findUnique({
      where: { id: params.id },
    });

    if (!medicine) {
      return NextResponse.json(
        { error: "Medicine not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(medicine);
  } catch (error) {
    console.error("Error fetching medicine:", error);
    return NextResponse.json(
      { error: "Failed to fetch medicine" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      genericName,
      manufacturer,
      batchNumber,
      expiryDate,
      quantity,
      reorderLevel,
      unitPrice,
      category,
    } = body ?? {};

    // Validation
    if (!name || !batchNumber || !expiryDate || quantity === undefined || !unitPrice || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: "Quantity must be positive" },
        { status: 400 }
      );
    }

    if (unitPrice <= 0) {
      return NextResponse.json(
        { error: "Unit price must be positive" },
        { status: 400 }
      );
    }

    const medicine = await prisma.medicine.update({
      where: { id: params.id },
      data: {
        name,
        genericName: genericName ?? null,
        manufacturer: manufacturer ?? null,
        batchNumber,
        expiryDate: new Date(expiryDate),
        quantity: parseInt(quantity.toString()),
        reorderLevel: reorderLevel ? parseInt(reorderLevel.toString()) : 10,
        unitPrice: parseFloat(unitPrice.toString()),
        category,
      },
    });

    return NextResponse.json(medicine);
  } catch (error) {
    console.error("Error updating medicine:", error);
    return NextResponse.json(
      { error: "Failed to update medicine" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.medicine.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Medicine deleted successfully" });
  } catch (error) {
    console.error("Error deleting medicine:", error);
    return NextResponse.json(
      { error: "Failed to delete medicine" },
      { status: 500 }
    );
  }
}
