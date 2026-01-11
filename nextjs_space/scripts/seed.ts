import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create branches first
  const branches = [
    {
      name: "DawaCare Main",
      code: "MAIN",
      address: "123 Kenyatta Avenue, Nairobi CBD",
      phone: "0720123456",
      email: "main@dawacare.co.ke",
      isMainBranch: true,
      status: "ACTIVE",
    },
    {
      name: "DawaCare Westlands",
      code: "WEST",
      address: "45 Waiyaki Way, Westlands",
      phone: "0721234567",
      email: "westlands@dawacare.co.ke",
      isMainBranch: false,
      status: "ACTIVE",
    },
  ];

  let mainBranch;
  let westlandsBranch;

  for (const branch of branches) {
    const existing = await prisma.branch.findUnique({
      where: { code: branch.code },
    });
    if (!existing) {
      const created = await prisma.branch.create({ data: branch });
      if (branch.code === "MAIN") mainBranch = created;
      if (branch.code === "WEST") westlandsBranch = created;
      console.log(`Branch ${branch.name} created`);
    } else {
      if (branch.code === "MAIN") mainBranch = existing;
      if (branch.code === "WEST") westlandsBranch = existing;
      console.log(`Branch ${branch.name} already exists`);
    }
  }

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
        branchId: mainBranch?.id,
      },
    });
    console.log("Admin user created");
  } else {
    await prisma.user.update({
      where: { email: "john@doe.com" },
      data: { role: "ADMIN", status: "ACTIVE", branchId: mainBranch?.id },
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
        branchId: mainBranch?.id,
      },
    });
    console.log("Pharmacist user created");
  } else {
    await prisma.user.update({
      where: { email: "pharmacist@dawacare.com" },
      data: { branchId: mainBranch?.id },
    });
    console.log("Pharmacist user updated with branch");
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
        branchId: westlandsBranch?.id,
      },
    });
    console.log("Cashier user created");
  } else {
    await prisma.user.update({
      where: { email: "cashier@dawacare.com" },
      data: { branchId: westlandsBranch?.id },
    });
    console.log("Cashier user updated with branch");
  }

  // Helper to generate dates
  const now = new Date();
  const addDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const addMonths = (months: number) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  // 5 Suppliers
  const suppliers = [
    {
      name: "Kenya Pharma Distributors Ltd",
      contactPerson: "James Mwangi",
      email: "orders@kenyapharma.co.ke",
      phone: "0720111222",
      address: "Industrial Area, Nairobi",
      status: "ACTIVE",
    },
    {
      name: "MediSupply East Africa",
      contactPerson: "Sarah Odhiambo",
      email: "supply@medisupply.co.ke",
      phone: "0733444555",
      address: "Mombasa Road, Nairobi",
      status: "ACTIVE",
    },
    {
      name: "PharmaCare International",
      contactPerson: "David Kimani",
      email: "info@pharmacare.com",
      phone: "0722666777",
      address: "Westlands, Nairobi",
      status: "ACTIVE",
    },
    {
      name: "Generic Meds Kenya",
      contactPerson: "Grace Wambui",
      email: "sales@genericmeds.co.ke",
      phone: "0711888999",
      address: "Ngong Road, Nairobi",
      status: "ACTIVE",
    },
    {
      name: "HealthPlus Supplies",
      contactPerson: "Peter Njoroge",
      email: "orders@healthplus.co.ke",
      phone: "0745123456",
      address: "Karen, Nairobi",
      status: "ACTIVE",
    },
  ];

  // Create suppliers
  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { name: supplier.name },
    });
    if (!existing) {
      await prisma.supplier.create({ data: supplier });
      console.log(`Supplier ${supplier.name} created`);
    } else {
      console.log(`Supplier ${supplier.name} already exists`);
    }
  }

  // 100 Medicines - comprehensive list
  const medicines = [
    // Antibiotics (15)
    { name: "Amoxicillin 500mg", genericName: "Amoxicillin", manufacturer: "Pfizer", batchNumber: "AMX-2025-001", expiryDate: addMonths(18), quantity: 250, reorderLevel: 50, unitPrice: 150, category: "Antibiotics" },
    { name: "Azithromycin 250mg", genericName: "Azithromycin", manufacturer: "Zithromax", batchNumber: "AZT-2025-002", expiryDate: addDays(20), quantity: 30, reorderLevel: 40, unitPrice: 220, category: "Antibiotics" },
    { name: "Ciprofloxacin 500mg", genericName: "Ciprofloxacin", manufacturer: "Bayer", batchNumber: "CIP-2025-003", expiryDate: addMonths(12), quantity: 180, reorderLevel: 30, unitPrice: 180, category: "Antibiotics" },
    { name: "Metronidazole 400mg", genericName: "Metronidazole", manufacturer: "Flagyl", batchNumber: "MET-2025-004", expiryDate: addMonths(24), quantity: 200, reorderLevel: 40, unitPrice: 95, category: "Antibiotics" },
    { name: "Doxycycline 100mg", genericName: "Doxycycline", manufacturer: "Vibramycin", batchNumber: "DOX-2025-005", expiryDate: addMonths(15), quantity: 120, reorderLevel: 25, unitPrice: 175, category: "Antibiotics" },
    { name: "Erythromycin 250mg", genericName: "Erythromycin", manufacturer: "E-Mycin", batchNumber: "ERY-2025-006", expiryDate: addMonths(18), quantity: 90, reorderLevel: 20, unitPrice: 160, category: "Antibiotics" },
    { name: "Ceftriaxone 1g Injection", genericName: "Ceftriaxone", manufacturer: "Rocephin", batchNumber: "CEF-2025-007", expiryDate: addMonths(12), quantity: 50, reorderLevel: 15, unitPrice: 450, category: "Antibiotics" },
    { name: "Amoxiclav 625mg", genericName: "Amoxicillin/Clavulanate", manufacturer: "Augmentin", batchNumber: "AUG-2025-008", expiryDate: addMonths(16), quantity: 150, reorderLevel: 30, unitPrice: 280, category: "Antibiotics" },
    { name: "Clindamycin 300mg", genericName: "Clindamycin", manufacturer: "Cleocin", batchNumber: "CLI-2025-009", expiryDate: addMonths(20), quantity: 80, reorderLevel: 20, unitPrice: 320, category: "Antibiotics" },
    { name: "Flucloxacillin 500mg", genericName: "Flucloxacillin", manufacturer: "Floxapen", batchNumber: "FLX-2025-010", expiryDate: addMonths(14), quantity: 100, reorderLevel: 25, unitPrice: 195, category: "Antibiotics" },
    { name: "Norfloxacin 400mg", genericName: "Norfloxacin", manufacturer: "Noroxin", batchNumber: "NOR-2025-011", expiryDate: addDays(25), quantity: 60, reorderLevel: 15, unitPrice: 145, category: "Antibiotics" },
    { name: "Gentamicin 80mg Injection", genericName: "Gentamicin", manufacturer: "Garamycin", batchNumber: "GEN-2025-012", expiryDate: addMonths(18), quantity: 40, reorderLevel: 10, unitPrice: 85, category: "Antibiotics" },
    { name: "Cotrimoxazole 480mg", genericName: "Sulfamethoxazole/Trimethoprim", manufacturer: "Septrin", batchNumber: "COT-2025-013", expiryDate: addMonths(22), quantity: 300, reorderLevel: 60, unitPrice: 65, category: "Antibiotics" },
    { name: "Nitrofurantoin 100mg", genericName: "Nitrofurantoin", manufacturer: "Macrobid", batchNumber: "NIT-2025-014", expiryDate: addMonths(15), quantity: 75, reorderLevel: 20, unitPrice: 125, category: "Antibiotics" },
    { name: "Tinidazole 500mg", genericName: "Tinidazole", manufacturer: "Fasigyn", batchNumber: "TIN-2025-015", expiryDate: addMonths(18), quantity: 110, reorderLevel: 25, unitPrice: 135, category: "Antibiotics" },

    // Painkillers (12)
    { name: "Paracetamol 500mg", genericName: "Acetaminophen", manufacturer: "Panadol", batchNumber: "PAR-2025-001", expiryDate: addDays(15), quantity: 600, reorderLevel: 100, unitPrice: 35, category: "Painkillers" },
    { name: "Ibuprofen 400mg", genericName: "Ibuprofen", manufacturer: "Brufen", batchNumber: "IBU-2025-002", expiryDate: addMonths(24), quantity: 500, reorderLevel: 100, unitPrice: 55, category: "Painkillers" },
    { name: "Diclofenac 50mg", genericName: "Diclofenac Sodium", manufacturer: "Voltaren", batchNumber: "DIC-2025-003", expiryDate: addMonths(18), quantity: 350, reorderLevel: 70, unitPrice: 75, category: "Painkillers" },
    { name: "Naproxen 250mg", genericName: "Naproxen Sodium", manufacturer: "Aleve", batchNumber: "NAP-2025-004", expiryDate: addMonths(15), quantity: 20, reorderLevel: 50, unitPrice: 120, category: "Painkillers" },
    { name: "Aspirin 300mg", genericName: "Acetylsalicylic Acid", manufacturer: "Disprin", batchNumber: "ASP-2025-005", expiryDate: addMonths(30), quantity: 400, reorderLevel: 80, unitPrice: 25, category: "Painkillers" },
    { name: "Tramadol 50mg", genericName: "Tramadol HCL", manufacturer: "Tramal", batchNumber: "TRA-2025-006", expiryDate: addMonths(12), quantity: 60, reorderLevel: 20, unitPrice: 185, category: "Painkillers" },
    { name: "Mefenamic Acid 500mg", genericName: "Mefenamic Acid", manufacturer: "Ponstan", batchNumber: "MEF-2025-007", expiryDate: addMonths(20), quantity: 180, reorderLevel: 40, unitPrice: 95, category: "Painkillers" },
    { name: "Celecoxib 200mg", genericName: "Celecoxib", manufacturer: "Celebrex", batchNumber: "CEL-2025-008", expiryDate: addMonths(16), quantity: 45, reorderLevel: 15, unitPrice: 280, category: "Painkillers" },
    { name: "Piroxicam 20mg", genericName: "Piroxicam", manufacturer: "Feldene", batchNumber: "PIR-2025-009", expiryDate: addMonths(18), quantity: 90, reorderLevel: 25, unitPrice: 145, category: "Painkillers" },
    { name: "Meloxicam 15mg", genericName: "Meloxicam", manufacturer: "Mobic", batchNumber: "MLX-2025-010", expiryDate: addMonths(22), quantity: 70, reorderLevel: 20, unitPrice: 165, category: "Painkillers" },
    { name: "Ketoprofen 100mg", genericName: "Ketoprofen", manufacturer: "Orudis", batchNumber: "KET-2025-011", expiryDate: addDays(28), quantity: 55, reorderLevel: 15, unitPrice: 135, category: "Painkillers" },
    { name: "Indomethacin 25mg", genericName: "Indomethacin", manufacturer: "Indocin", batchNumber: "IND-2025-012", expiryDate: addMonths(14), quantity: 65, reorderLevel: 15, unitPrice: 115, category: "Painkillers" },

    // Vitamins & Supplements (12)
    { name: "Vitamin D3 1000IU", genericName: "Cholecalciferol", manufacturer: "Nature Made", batchNumber: "VTD-2025-001", expiryDate: addMonths(36), quantity: 300, reorderLevel: 50, unitPrice: 180, category: "Vitamins" },
    { name: "Vitamin C 500mg", genericName: "Ascorbic Acid", manufacturer: "Centrum", batchNumber: "VTC-2025-002", expiryDate: addMonths(24), quantity: 8, reorderLevel: 30, unitPrice: 120, category: "Vitamins" },
    { name: "Multivitamin Daily", genericName: "Multivitamin Complex", manufacturer: "One A Day", batchNumber: "MVT-2025-003", expiryDate: addMonths(18), quantity: 200, reorderLevel: 40, unitPrice: 250, category: "Vitamins" },
    { name: "Vitamin B Complex", genericName: "B-Complex Vitamins", manufacturer: "Neurobion", batchNumber: "VTB-2025-004", expiryDate: addMonths(24), quantity: 150, reorderLevel: 30, unitPrice: 195, category: "Vitamins" },
    { name: "Folic Acid 5mg", genericName: "Folic Acid", manufacturer: "Folvite", batchNumber: "FOL-2025-005", expiryDate: addMonths(30), quantity: 250, reorderLevel: 50, unitPrice: 45, category: "Vitamins" },
    { name: "Iron Supplement 65mg", genericName: "Ferrous Sulfate", manufacturer: "Feroglobin", batchNumber: "IRN-2025-006", expiryDate: addMonths(20), quantity: 180, reorderLevel: 40, unitPrice: 85, category: "Vitamins" },
    { name: "Calcium + D3 600mg", genericName: "Calcium Carbonate", manufacturer: "Caltrate", batchNumber: "CAL-2025-007", expiryDate: addMonths(28), quantity: 120, reorderLevel: 30, unitPrice: 220, category: "Vitamins" },
    { name: "Vitamin E 400IU", genericName: "Alpha-Tocopherol", manufacturer: "Nature's Bounty", batchNumber: "VTE-2025-008", expiryDate: addMonths(24), quantity: 90, reorderLevel: 25, unitPrice: 175, category: "Vitamins" },
    { name: "Omega-3 Fish Oil 1000mg", genericName: "Fish Oil EPA/DHA", manufacturer: "Seven Seas", batchNumber: "OMG-2025-009", expiryDate: addMonths(18), quantity: 100, reorderLevel: 25, unitPrice: 350, category: "Vitamins" },
    { name: "Zinc 50mg", genericName: "Zinc Gluconate", manufacturer: "Solgar", batchNumber: "ZNC-2025-010", expiryDate: addMonths(26), quantity: 140, reorderLevel: 35, unitPrice: 145, category: "Vitamins" },
    { name: "Vitamin A 10000IU", genericName: "Retinol", manufacturer: "Now Foods", batchNumber: "VTA-2025-011", expiryDate: addMonths(22), quantity: 75, reorderLevel: 20, unitPrice: 165, category: "Vitamins" },
    { name: "Magnesium 400mg", genericName: "Magnesium Citrate", manufacturer: "Doctor's Best", batchNumber: "MAG-2025-012", expiryDate: addMonths(20), quantity: 110, reorderLevel: 30, unitPrice: 195, category: "Vitamins" },

    // Antacids & GI (10)
    { name: "Omeprazole 20mg", genericName: "Omeprazole", manufacturer: "Prilosec", batchNumber: "OMP-2025-001", expiryDate: addMonths(12), quantity: 150, reorderLevel: 30, unitPrice: 185, category: "Antacids" },
    { name: "Ranitidine 150mg", genericName: "Ranitidine", manufacturer: "Zantac", batchNumber: "RAN-2025-002", expiryDate: addDays(25), quantity: 5, reorderLevel: 25, unitPrice: 125, category: "Antacids" },
    { name: "Esomeprazole 40mg", genericName: "Esomeprazole", manufacturer: "Nexium", batchNumber: "ESO-2025-003", expiryDate: addMonths(18), quantity: 100, reorderLevel: 25, unitPrice: 245, category: "Antacids" },
    { name: "Pantoprazole 40mg", genericName: "Pantoprazole", manufacturer: "Protonix", batchNumber: "PAN-2025-004", expiryDate: addMonths(16), quantity: 130, reorderLevel: 30, unitPrice: 195, category: "Antacids" },
    { name: "Antacid Suspension 200ml", genericName: "Aluminum/Magnesium Hydroxide", manufacturer: "Maalox", batchNumber: "ANT-2025-005", expiryDate: addMonths(14), quantity: 80, reorderLevel: 20, unitPrice: 145, category: "Antacids" },
    { name: "Domperidone 10mg", genericName: "Domperidone", manufacturer: "Motilium", batchNumber: "DOM-2025-006", expiryDate: addMonths(20), quantity: 200, reorderLevel: 40, unitPrice: 95, category: "Antacids" },
    { name: "Metoclopramide 10mg", genericName: "Metoclopramide", manufacturer: "Reglan", batchNumber: "MTC-2025-007", expiryDate: addMonths(18), quantity: 150, reorderLevel: 35, unitPrice: 75, category: "Antacids" },
    { name: "Loperamide 2mg", genericName: "Loperamide HCL", manufacturer: "Imodium", batchNumber: "LOP-2025-008", expiryDate: addMonths(24), quantity: 180, reorderLevel: 40, unitPrice: 85, category: "Antacids" },
    { name: "ORS Sachets", genericName: "Oral Rehydration Salts", manufacturer: "WHO ORS", batchNumber: "ORS-2025-009", expiryDate: addMonths(30), quantity: 500, reorderLevel: 100, unitPrice: 25, category: "Antacids" },
    { name: "Bisacodyl 5mg", genericName: "Bisacodyl", manufacturer: "Dulcolax", batchNumber: "BIS-2025-010", expiryDate: addMonths(22), quantity: 120, reorderLevel: 30, unitPrice: 65, category: "Antacids" },

    // Antihistamines (8)
    { name: "Cetirizine 10mg", genericName: "Cetirizine HCL", manufacturer: "Zyrtec", batchNumber: "CET-2025-001", expiryDate: addMonths(20), quantity: 400, reorderLevel: 60, unitPrice: 85, category: "Antihistamines" },
    { name: "Loratadine 10mg", genericName: "Loratadine", manufacturer: "Claritin", batchNumber: "LOR-2025-002", expiryDate: addMonths(15), quantity: 350, reorderLevel: 50, unitPrice: 95, category: "Antihistamines" },
    { name: "Chlorpheniramine 4mg", genericName: "Chlorpheniramine Maleate", manufacturer: "Piriton", batchNumber: "CHL-2025-003", expiryDate: addMonths(24), quantity: 300, reorderLevel: 60, unitPrice: 35, category: "Antihistamines" },
    { name: "Diphenhydramine 25mg", genericName: "Diphenhydramine HCL", manufacturer: "Benadryl", batchNumber: "DPH-2025-004", expiryDate: addMonths(20), quantity: 200, reorderLevel: 40, unitPrice: 65, category: "Antihistamines" },
    { name: "Fexofenadine 120mg", genericName: "Fexofenadine HCL", manufacturer: "Allegra", batchNumber: "FEX-2025-005", expiryDate: addMonths(18), quantity: 90, reorderLevel: 25, unitPrice: 145, category: "Antihistamines" },
    { name: "Desloratadine 5mg", genericName: "Desloratadine", manufacturer: "Clarinex", batchNumber: "DES-2025-006", expiryDate: addMonths(16), quantity: 75, reorderLevel: 20, unitPrice: 165, category: "Antihistamines" },
    { name: "Promethazine 25mg", genericName: "Promethazine HCL", manufacturer: "Phenergan", batchNumber: "PRO-2025-007", expiryDate: addDays(30), quantity: 60, reorderLevel: 15, unitPrice: 125, category: "Antihistamines" },
    { name: "Hydroxyzine 25mg", genericName: "Hydroxyzine HCL", manufacturer: "Atarax", batchNumber: "HYX-2025-008", expiryDate: addMonths(14), quantity: 50, reorderLevel: 15, unitPrice: 115, category: "Antihistamines" },

    // Cardiovascular (12)
    { name: "Atorvastatin 20mg", genericName: "Atorvastatin Calcium", manufacturer: "Lipitor", batchNumber: "ATV-2025-001", expiryDate: addMonths(24), quantity: 100, reorderLevel: 20, unitPrice: 285, category: "Cardiovascular" },
    { name: "Lisinopril 10mg", genericName: "Lisinopril", manufacturer: "Prinivil", batchNumber: "LIS-2025-002", expiryDate: addDays(10), quantity: 80, reorderLevel: 25, unitPrice: 195, category: "Cardiovascular" },
    { name: "Metoprolol 50mg", genericName: "Metoprolol Tartrate", manufacturer: "Lopressor", batchNumber: "MTP-2025-003", expiryDate: addMonths(18), quantity: 15, reorderLevel: 30, unitPrice: 225, category: "Cardiovascular" },
    { name: "Amlodipine 5mg", genericName: "Amlodipine Besylate", manufacturer: "Norvasc", batchNumber: "AML-2025-004", expiryDate: addMonths(20), quantity: 150, reorderLevel: 35, unitPrice: 175, category: "Cardiovascular" },
    { name: "Losartan 50mg", genericName: "Losartan Potassium", manufacturer: "Cozaar", batchNumber: "LOS-2025-005", expiryDate: addMonths(22), quantity: 120, reorderLevel: 30, unitPrice: 215, category: "Cardiovascular" },
    { name: "Enalapril 10mg", genericName: "Enalapril Maleate", manufacturer: "Vasotec", batchNumber: "ENA-2025-006", expiryDate: addMonths(16), quantity: 90, reorderLevel: 25, unitPrice: 165, category: "Cardiovascular" },
    { name: "Furosemide 40mg", genericName: "Furosemide", manufacturer: "Lasix", batchNumber: "FUR-2025-007", expiryDate: addMonths(18), quantity: 200, reorderLevel: 50, unitPrice: 55, category: "Cardiovascular" },
    { name: "Hydrochlorothiazide 25mg", genericName: "Hydrochlorothiazide", manufacturer: "Microzide", batchNumber: "HCT-2025-008", expiryDate: addMonths(24), quantity: 180, reorderLevel: 40, unitPrice: 45, category: "Cardiovascular" },
    { name: "Warfarin 5mg", genericName: "Warfarin Sodium", manufacturer: "Coumadin", batchNumber: "WAR-2025-009", expiryDate: addMonths(14), quantity: 50, reorderLevel: 15, unitPrice: 145, category: "Cardiovascular" },
    { name: "Clopidogrel 75mg", genericName: "Clopidogrel Bisulfate", manufacturer: "Plavix", batchNumber: "CLO-2025-010", expiryDate: addMonths(20), quantity: 70, reorderLevel: 20, unitPrice: 275, category: "Cardiovascular" },
    { name: "Rosuvastatin 10mg", genericName: "Rosuvastatin Calcium", manufacturer: "Crestor", batchNumber: "ROS-2025-011", expiryDate: addMonths(18), quantity: 85, reorderLevel: 20, unitPrice: 320, category: "Cardiovascular" },
    { name: "Carvedilol 25mg", genericName: "Carvedilol", manufacturer: "Coreg", batchNumber: "CAR-2025-012", expiryDate: addMonths(16), quantity: 60, reorderLevel: 15, unitPrice: 245, category: "Cardiovascular" },

    // Diabetes (8)
    { name: "Metformin 500mg", genericName: "Metformin HCL", manufacturer: "Glucophage", batchNumber: "MTF-2025-001", expiryDate: addMonths(24), quantity: 250, reorderLevel: 50, unitPrice: 75, category: "Diabetes" },
    { name: "Glimepiride 2mg", genericName: "Glimepiride", manufacturer: "Amaryl", batchNumber: "GLI-2025-002", expiryDate: addMonths(12), quantity: 120, reorderLevel: 25, unitPrice: 145, category: "Diabetes" },
    { name: "Gliclazide 80mg", genericName: "Gliclazide", manufacturer: "Diamicron", batchNumber: "GLC-2025-003", expiryDate: addMonths(18), quantity: 100, reorderLevel: 25, unitPrice: 165, category: "Diabetes" },
    { name: "Sitagliptin 100mg", genericName: "Sitagliptin Phosphate", manufacturer: "Januvia", batchNumber: "SIT-2025-004", expiryDate: addMonths(16), quantity: 45, reorderLevel: 15, unitPrice: 485, category: "Diabetes" },
    { name: "Pioglitazone 30mg", genericName: "Pioglitazone HCL", manufacturer: "Actos", batchNumber: "PIO-2025-005", expiryDate: addMonths(20), quantity: 60, reorderLevel: 15, unitPrice: 285, category: "Diabetes" },
    { name: "Insulin Glargine 100IU/ml", genericName: "Insulin Glargine", manufacturer: "Lantus", batchNumber: "INS-2025-006", expiryDate: addMonths(6), quantity: 25, reorderLevel: 10, unitPrice: 2500, category: "Diabetes" },
    { name: "Empagliflozin 25mg", genericName: "Empagliflozin", manufacturer: "Jardiance", batchNumber: "EMP-2025-007", expiryDate: addMonths(14), quantity: 35, reorderLevel: 10, unitPrice: 550, category: "Diabetes" },
    { name: "Glucometer Test Strips (50)", genericName: "Blood Glucose Test Strips", manufacturer: "Accu-Chek", batchNumber: "GTS-2025-008", expiryDate: addMonths(12), quantity: 80, reorderLevel: 20, unitPrice: 850, category: "Diabetes" },

    // Dermatological (8)
    { name: "Hydrocortisone 1% Cream", genericName: "Hydrocortisone", manufacturer: "Cortaid", batchNumber: "HYD-2025-001", expiryDate: addMonths(18), quantity: 75, reorderLevel: 20, unitPrice: 185, category: "Dermatological" },
    { name: "Clotrimazole 1% Cream", genericName: "Clotrimazole", manufacturer: "Lotrimin", batchNumber: "CLT-2025-002", expiryDate: addDays(28), quantity: 45, reorderLevel: 15, unitPrice: 145, category: "Dermatological" },
    { name: "Betamethasone 0.1% Cream", genericName: "Betamethasone Valerate", manufacturer: "Celestone", batchNumber: "BET-2025-003", expiryDate: addMonths(16), quantity: 55, reorderLevel: 15, unitPrice: 225, category: "Dermatological" },
    { name: "Miconazole 2% Cream", genericName: "Miconazole Nitrate", manufacturer: "Daktarin", batchNumber: "MIC-2025-004", expiryDate: addMonths(20), quantity: 60, reorderLevel: 15, unitPrice: 165, category: "Dermatological" },
    { name: "Fusidic Acid 2% Cream", genericName: "Fusidic Acid", manufacturer: "Fucidin", batchNumber: "FUS-2025-005", expiryDate: addMonths(14), quantity: 40, reorderLevel: 10, unitPrice: 285, category: "Dermatological" },
    { name: "Ketoconazole 2% Shampoo", genericName: "Ketoconazole", manufacturer: "Nizoral", batchNumber: "KTZ-2025-006", expiryDate: addMonths(18), quantity: 50, reorderLevel: 15, unitPrice: 350, category: "Dermatological" },
    { name: "Acne Gel (Benzoyl Peroxide)", genericName: "Benzoyl Peroxide 5%", manufacturer: "Benzac", batchNumber: "ACN-2025-007", expiryDate: addMonths(12), quantity: 35, reorderLevel: 10, unitPrice: 275, category: "Dermatological" },
    { name: "Calamine Lotion 100ml", genericName: "Calamine/Zinc Oxide", manufacturer: "Generic", batchNumber: "CAM-2025-008", expiryDate: addMonths(24), quantity: 100, reorderLevel: 25, unitPrice: 85, category: "Dermatological" },

    // Respiratory (8)
    { name: "Salbutamol Inhaler 100mcg", genericName: "Albuterol", manufacturer: "Ventolin", batchNumber: "SAL-2025-001", expiryDate: addMonths(12), quantity: 50, reorderLevel: 15, unitPrice: 450, category: "Respiratory" },
    { name: "Fluticasone Nasal Spray", genericName: "Fluticasone Propionate", manufacturer: "Flonase", batchNumber: "FLT-2025-002", expiryDate: addMonths(15), quantity: 3, reorderLevel: 10, unitPrice: 385, category: "Respiratory" },
    { name: "Beclomethasone Inhaler", genericName: "Beclomethasone Dipropionate", manufacturer: "Qvar", batchNumber: "BCL-2025-003", expiryDate: addMonths(14), quantity: 30, reorderLevel: 10, unitPrice: 520, category: "Respiratory" },
    { name: "Montelukast 10mg", genericName: "Montelukast Sodium", manufacturer: "Singulair", batchNumber: "MTL-2025-004", expiryDate: addMonths(18), quantity: 80, reorderLevel: 20, unitPrice: 245, category: "Respiratory" },
    { name: "Theophylline 300mg", genericName: "Theophylline", manufacturer: "Theo-Dur", batchNumber: "THE-2025-005", expiryDate: addMonths(16), quantity: 60, reorderLevel: 15, unitPrice: 125, category: "Respiratory" },
    { name: "Cough Syrup (Dextromethorphan)", genericName: "Dextromethorphan HBr", manufacturer: "Robitussin", batchNumber: "COF-2025-006", expiryDate: addMonths(20), quantity: 120, reorderLevel: 30, unitPrice: 185, category: "Respiratory" },
    { name: "Ambroxol Syrup 100ml", genericName: "Ambroxol HCL", manufacturer: "Mucosolvan", batchNumber: "AMB-2025-007", expiryDate: addMonths(18), quantity: 90, reorderLevel: 25, unitPrice: 145, category: "Respiratory" },
    { name: "Nasal Decongestant Spray", genericName: "Oxymetazoline HCL", manufacturer: "Afrin", batchNumber: "NAS-2025-008", expiryDate: addMonths(14), quantity: 70, reorderLevel: 20, unitPrice: 165, category: "Respiratory" },

    // Other/Miscellaneous (7)
    { name: "Melatonin 5mg", genericName: "Melatonin", manufacturer: "Natrol", batchNumber: "MEL-2025-001", expiryDate: addMonths(24), quantity: 180, reorderLevel: 30, unitPrice: 195, category: "Other" },
    { name: "Diazepam 5mg", genericName: "Diazepam", manufacturer: "Valium", batchNumber: "DIZ-2025-002", expiryDate: addMonths(12), quantity: 30, reorderLevel: 10, unitPrice: 165, category: "Other" },
    { name: "Amitriptyline 25mg", genericName: "Amitriptyline HCL", manufacturer: "Elavil", batchNumber: "AMT-2025-003", expiryDate: addMonths(18), quantity: 70, reorderLevel: 20, unitPrice: 95, category: "Other" },
    { name: "Sertraline 50mg", genericName: "Sertraline HCL", manufacturer: "Zoloft", batchNumber: "SER-2025-004", expiryDate: addMonths(16), quantity: 55, reorderLevel: 15, unitPrice: 285, category: "Other" },
    { name: "Eye Drops (Artificial Tears)", genericName: "Carboxymethylcellulose", manufacturer: "Refresh", batchNumber: "EYE-2025-005", expiryDate: addMonths(12), quantity: 100, reorderLevel: 25, unitPrice: 145, category: "Other" },
    { name: "Ear Drops (Ciprofloxacin)", genericName: "Ciprofloxacin 0.3%", manufacturer: "Ciprodex", batchNumber: "EAR-2025-006", expiryDate: addMonths(14), quantity: 45, reorderLevel: 15, unitPrice: 265, category: "Other" },
    { name: "Antiseptic Solution 500ml", genericName: "Chlorhexidine Gluconate", manufacturer: "Savlon", batchNumber: "ANS-2025-007", expiryDate: addMonths(30), quantity: 80, reorderLevel: 20, unitPrice: 185, category: "Other" },
  ];

  // Clear existing medicines
  await prisma.medicine.deleteMany();
  console.log("Cleared existing medicines");

  // Insert medicines - distribute between branches (70 to main, 30 to westlands)
  for (let i = 0; i < medicines.length; i++) {
    const medicine = medicines[i];
    const branchId = i < 70 ? mainBranch?.id : westlandsBranch?.id;
    await prisma.medicine.create({ 
      data: { ...medicine, branchId } 
    });
  }

  console.log(`Created ${medicines.length} medicines across branches`);

  // Sample customers
  const customers = [
    {
      name: "Mary Wanjiku",
      phone: "0722123456",
      email: "mary.wanjiku@email.com",
      address: "123 Moi Avenue, Nairobi",
      gender: "FEMALE",
      loyaltyPoints: 150,
      creditBalance: 0,
      creditLimit: 5000,
      status: "ACTIVE",
    },
    {
      name: "John Kamau",
      phone: "0733987654",
      email: "john.kamau@email.com",
      address: "45 Uhuru Highway, Nairobi",
      gender: "MALE",
      loyaltyPoints: 320,
      creditBalance: 2500,
      creditLimit: 10000,
      status: "ACTIVE",
    },
    {
      name: "Grace Njeri",
      phone: "0711456789",
      email: "grace.njeri@email.com",
      address: "78 Kenyatta Avenue, Nairobi",
      gender: "FEMALE",
      loyaltyPoints: 75,
      creditBalance: 0,
      creditLimit: 3000,
      status: "ACTIVE",
    },
    {
      name: "Peter Ochieng",
      phone: "0745678901",
      email: "peter.ochieng@email.com",
      address: "12 Oginga Odinga Street, Kisumu",
      gender: "MALE",
      loyaltyPoints: 500,
      creditBalance: 1200,
      creditLimit: 8000,
      status: "ACTIVE",
    },
    {
      name: "Faith Muthoni",
      phone: "0756789012",
      email: null,
      address: "56 Kimathi Street, Nakuru",
      gender: "FEMALE",
      loyaltyPoints: 25,
      creditBalance: 0,
      creditLimit: 0,
      status: "ACTIVE",
    },
  ];

  // Create customers if they don't exist
  for (const customer of customers) {
    const existing = await prisma.customer.findUnique({
      where: { phone: customer.phone },
    });
    if (!existing) {
      await prisma.customer.create({ data: customer });
    }
  }

  console.log(`Created/verified ${customers.length} customers`);
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
