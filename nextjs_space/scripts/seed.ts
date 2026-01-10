import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create users with different roles
  const hashedPassword = await bcrypt.hash("johndoe123", 10);
  
  // Admin user (john@doe.com - existing user upgraded to admin)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "john@doe.com" },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: "john@doe.com",
        name: "John Doe",
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log("Admin user created");
  } else {
    // Update existing user to ADMIN role
    await prisma.user.update({
      where: { email: "john@doe.com" },
      data: { role: "ADMIN", status: "ACTIVE" },
    });
    console.log("Admin user updated");
  }

  // Pharmacist user
  const existingPharmacist = await prisma.user.findUnique({
    where: { email: "pharmacist@dawacare.com" },
  });

  if (!existingPharmacist) {
    await prisma.user.create({
      data: {
        email: "pharmacist@dawacare.com",
        name: "Sarah Pharmacist",
        password: hashedPassword,
        role: "PHARMACIST",
        status: "ACTIVE",
      },
    });
    console.log("Pharmacist user created");
  } else {
    console.log("Pharmacist user already exists");
  }

  // Cashier user
  const existingCashier = await prisma.user.findUnique({
    where: { email: "cashier@dawacare.com" },
  });

  if (!existingCashier) {
    await prisma.user.create({
      data: {
        email: "cashier@dawacare.com",
        name: "Mike Cashier",
        password: hashedPassword,
        role: "CASHIER",
        status: "ACTIVE",
      },
    });
    console.log("Cashier user created");
  } else {
    console.log("Cashier user already exists");
  }

  // Helper to generate dates
  const now = new Date();
  const addDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const addMonths = (months: number) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  // Sample medicines data
  const medicines = [
    // Antibiotics
    {
      name: "Amoxicillin 500mg",
      genericName: "Amoxicillin",
      manufacturer: "Pfizer",
      batchNumber: "AMX-2025-001",
      expiryDate: addMonths(18),
      quantity: 250,
      reorderLevel: 50,
      unitPrice: 12.99,
      category: "Antibiotics",
    },
    {
      name: "Azithromycin 250mg",
      genericName: "Azithromycin",
      manufacturer: "Zithromax",
      batchNumber: "AZT-2025-002",
      expiryDate: addDays(20), // Expiring soon
      quantity: 30, // Low stock
      reorderLevel: 40,
      unitPrice: 18.50,
      category: "Antibiotics",
    },
    {
      name: "Ciprofloxacin 500mg",
      genericName: "Ciprofloxacin",
      manufacturer: "Bayer",
      batchNumber: "CIP-2025-003",
      expiryDate: addMonths(12),
      quantity: 180,
      reorderLevel: 30,
      unitPrice: 15.75,
      category: "Antibiotics",
    },

    // Painkillers
    {
      name: "Ibuprofen 400mg",
      genericName: "Ibuprofen",
      manufacturer: "Advil",
      batchNumber: "IBU-2025-004",
      expiryDate: addMonths(24),
      quantity: 500,
      reorderLevel: 100,
      unitPrice: 8.99,
      category: "Painkillers",
    },
    {
      name: "Paracetamol 500mg",
      genericName: "Acetaminophen",
      manufacturer: "Tylenol",
      batchNumber: "PAR-2025-005",
      expiryDate: addDays(15), // Expiring very soon
      quantity: 600,
      reorderLevel: 100,
      unitPrice: 5.99,
      category: "Painkillers",
    },
    {
      name: "Naproxen 250mg",
      genericName: "Naproxen Sodium",
      manufacturer: "Aleve",
      batchNumber: "NAP-2025-006",
      expiryDate: addMonths(15),
      quantity: 20, // Low stock
      reorderLevel: 50,
      unitPrice: 11.25,
      category: "Painkillers",
    },

    // Vitamins
    {
      name: "Vitamin D3 1000IU",
      genericName: "Cholecalciferol",
      manufacturer: "Nature Made",
      batchNumber: "VTD-2025-007",
      expiryDate: addMonths(36),
      quantity: 300,
      reorderLevel: 50,
      unitPrice: 14.99,
      category: "Vitamins",
    },
    {
      name: "Vitamin C 500mg",
      genericName: "Ascorbic Acid",
      manufacturer: "Centrum",
      batchNumber: "VTC-2025-008",
      expiryDate: addMonths(24),
      quantity: 8, // Very low stock
      reorderLevel: 30,
      unitPrice: 9.99,
      category: "Vitamins",
    },
    {
      name: "Multivitamin Daily",
      genericName: "Multivitamin Complex",
      manufacturer: "One A Day",
      batchNumber: "MVT-2025-009",
      expiryDate: addMonths(18),
      quantity: 200,
      reorderLevel: 40,
      unitPrice: 19.99,
      category: "Vitamins",
    },

    // Antacids
    {
      name: "Omeprazole 20mg",
      genericName: "Omeprazole",
      manufacturer: "Prilosec",
      batchNumber: "OMP-2025-010",
      expiryDate: addMonths(12),
      quantity: 150,
      reorderLevel: 30,
      unitPrice: 22.50,
      category: "Antacids",
    },
    {
      name: "Ranitidine 150mg",
      genericName: "Ranitidine",
      manufacturer: "Zantac",
      batchNumber: "RAN-2025-011",
      expiryDate: addDays(25), // Expiring soon
      quantity: 5, // Critical low stock
      reorderLevel: 25,
      unitPrice: 16.75,
      category: "Antacids",
    },

    // Antihistamines
    {
      name: "Cetirizine 10mg",
      genericName: "Cetirizine HCL",
      manufacturer: "Zyrtec",
      batchNumber: "CET-2025-012",
      expiryDate: addMonths(20),
      quantity: 400,
      reorderLevel: 60,
      unitPrice: 12.99,
      category: "Antihistamines",
    },
    {
      name: "Loratadine 10mg",
      genericName: "Loratadine",
      manufacturer: "Claritin",
      batchNumber: "LOR-2025-013",
      expiryDate: addMonths(15),
      quantity: 350,
      reorderLevel: 50,
      unitPrice: 13.50,
      category: "Antihistamines",
    },

    // Cardiovascular
    {
      name: "Atorvastatin 20mg",
      genericName: "Atorvastatin Calcium",
      manufacturer: "Lipitor",
      batchNumber: "ATV-2025-014",
      expiryDate: addMonths(24),
      quantity: 100,
      reorderLevel: 20,
      unitPrice: 45.99,
      category: "Cardiovascular",
    },
    {
      name: "Lisinopril 10mg",
      genericName: "Lisinopril",
      manufacturer: "Prinivil",
      batchNumber: "LIS-2025-015",
      expiryDate: addDays(10), // Very close to expiry
      quantity: 80,
      reorderLevel: 25,
      unitPrice: 28.75,
      category: "Cardiovascular",
    },
    {
      name: "Metoprolol 50mg",
      genericName: "Metoprolol Tartrate",
      manufacturer: "Lopressor",
      batchNumber: "MET-2025-016",
      expiryDate: addMonths(18),
      quantity: 15, // Low stock
      reorderLevel: 30,
      unitPrice: 32.00,
      category: "Cardiovascular",
    },

    // Diabetes
    {
      name: "Metformin 500mg",
      genericName: "Metformin HCL",
      manufacturer: "Glucophage",
      batchNumber: "MTF-2025-017",
      expiryDate: addMonths(24),
      quantity: 250,
      reorderLevel: 50,
      unitPrice: 18.99,
      category: "Diabetes",
    },
    {
      name: "Glimepiride 2mg",
      genericName: "Glimepiride",
      manufacturer: "Amaryl",
      batchNumber: "GLI-2025-018",
      expiryDate: addMonths(12),
      quantity: 120,
      reorderLevel: 25,
      unitPrice: 24.50,
      category: "Diabetes",
    },

    // Dermatological
    {
      name: "Hydrocortisone 1% Cream",
      genericName: "Hydrocortisone",
      manufacturer: "Cortaid",
      batchNumber: "HYD-2025-019",
      expiryDate: addMonths(18),
      quantity: 75,
      reorderLevel: 20,
      unitPrice: 7.99,
      category: "Dermatological",
    },
    {
      name: "Clotrimazole 1% Cream",
      genericName: "Clotrimazole",
      manufacturer: "Lotrimin",
      batchNumber: "CLO-2025-020",
      expiryDate: addDays(28), // Expiring soon
      quantity: 45,
      reorderLevel: 15,
      unitPrice: 9.50,
      category: "Dermatological",
    },

    // Respiratory
    {
      name: "Salbutamol Inhaler 100mcg",
      genericName: "Albuterol",
      manufacturer: "Ventolin",
      batchNumber: "SAL-2025-021",
      expiryDate: addMonths(12),
      quantity: 50,
      reorderLevel: 15,
      unitPrice: 35.00,
      category: "Respiratory",
    },
    {
      name: "Fluticasone Nasal Spray",
      genericName: "Fluticasone Propionate",
      manufacturer: "Flonase",
      batchNumber: "FLU-2025-022",
      expiryDate: addMonths(15),
      quantity: 3, // Very low stock
      reorderLevel: 10,
      unitPrice: 28.99,
      category: "Respiratory",
    },

    // Other
    {
      name: "Diphenhydramine 25mg",
      genericName: "Diphenhydramine HCL",
      manufacturer: "Benadryl",
      batchNumber: "DPH-2025-023",
      expiryDate: addMonths(20),
      quantity: 200,
      reorderLevel: 40,
      unitPrice: 8.50,
      category: "Other",
    },
    {
      name: "Melatonin 5mg",
      genericName: "Melatonin",
      manufacturer: "Natrol",
      batchNumber: "MEL-2025-024",
      expiryDate: addMonths(24),
      quantity: 180,
      reorderLevel: 30,
      unitPrice: 12.00,
      category: "Other",
    },
  ];

  // Clear existing medicines
  await prisma.medicine.deleteMany();
  console.log("Cleared existing medicines");

  // Insert medicines
  for (const medicine of medicines) {
    await prisma.medicine.create({ data: medicine });
  }

  console.log(`Created ${medicines.length} medicines`);
  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
