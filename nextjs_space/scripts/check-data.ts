import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function counts() {
  console.log("\n=== DATABASE SUMMARY ===\n");
  
  const branches = await prisma.branch.count();
  const users = await prisma.user.count();
  const medicines = await prisma.medicine.count();
  const suppliers = await prisma.supplier.count();
  const customers = await prisma.customer.count();
  const purchaseOrders = await prisma.purchaseOrder.count();
  const grns = await prisma.goodsReceivedNote.count();
  const sales = await prisma.sale.count();
  const accountMappings = await prisma.accountMapping.count();
  
  console.log("Branches:", branches);
  console.log("Users:", users);
  console.log("Medicines:", medicines);
  console.log("Suppliers:", suppliers);
  console.log("Customers:", customers);
  console.log("Purchase Orders:", purchaseOrders);
  console.log("GRNs:", grns);
  console.log("Sales:", sales);
  console.log("Account Mappings:", accountMappings);
  
  const poStatuses = await prisma.purchaseOrder.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log("\nPurchase Orders by Status:");
  poStatuses.forEach((s: any) => console.log("  ", s.status + ":", s._count));
  
  const categories = await prisma.medicine.groupBy({
    by: ['category'],
    _count: true,
  });
  console.log("\nMedicines by Category:");
  categories.forEach((c: any) => console.log("  ", c.category + ":", c._count));
  
  const totalSales = await prisma.sale.aggregate({
    _sum: { total: true },
    _count: true,
  });
  console.log("\nTotal Sales:", totalSales._count, "transactions");
  console.log("Total Revenue: KES", totalSales._sum.total?.toLocaleString());
  
  await prisma.$disconnect();
}

counts();
