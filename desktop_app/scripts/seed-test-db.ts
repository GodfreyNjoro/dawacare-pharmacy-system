import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Use SQLite for test database
const TEST_DB_PATH = path.join(__dirname, '..', 'test.db');

// Remove existing test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log('Removed existing test database');
}

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

// Run Prisma migrations to create schema
console.log('Creating database schema...');
try {
  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB_PATH}`
    }
  });
  console.log('✓ Database schema created');
} catch (error) {
  console.error('Failed to create database schema:', error);
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${TEST_DB_PATH}`
    }
  }
});

async function main() {
  console.log('\nSeeding test database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin@dawacare.local',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });
  console.log('✓ Created admin user:', admin.email);

  // Create cashier user
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const cashier = await prisma.user.create({
    data: {
      name: 'Test Cashier',
      email: 'cashier@dawacare.local',
      password: cashierPassword,
      role: 'CASHIER'
    }
  });
  console.log('✓ Created cashier user:', cashier.email);

  // Create sample medicines
  const medicines = [
    {
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      batchNumber: 'BATCH001',
      quantity: 500,
      unitPrice: 10,
      expiryDate: new Date('2025-12-31'),
      category: 'ANALGESICS'
    },
    {
      name: 'Amoxicillin 250mg',
      genericName: 'Amoxicillin',
      batchNumber: 'BATCH002',
      quantity: 300,
      unitPrice: 25,
      expiryDate: new Date('2025-10-15'),
      category: 'ANTIBIOTICS'
    },
    {
      name: 'Ibuprofen 400mg',
      genericName: 'Ibuprofen',
      batchNumber: 'BATCH003',
      quantity: 400,
      unitPrice: 15,
      expiryDate: new Date('2026-03-20'),
      category: 'ANALGESICS'
    },
    {
      name: 'Omeprazole 20mg',
      genericName: 'Omeprazole',
      batchNumber: 'BATCH004',
      quantity: 200,
      unitPrice: 20,
      expiryDate: new Date('2025-08-10'),
      category: 'ANTACIDS'
    },
    {
      name: 'Aspirin 100mg',
      genericName: 'Aspirin',
      batchNumber: 'BATCH005',
      quantity: 350,
      unitPrice: 7,
      expiryDate: new Date('2026-01-15'),
      category: 'ANALGESICS'
    },
    {
      name: 'Metformin 500mg',
      genericName: 'Metformin',
      batchNumber: 'BATCH006',
      quantity: 250,
      unitPrice: 18,
      expiryDate: new Date('2025-11-30'),
      category: 'ANTIDIABETICS'
    },
    {
      name: 'Cetirizine 10mg',
      genericName: 'Cetirizine',
      batchNumber: 'BATCH007',
      quantity: 180,
      unitPrice: 12,
      expiryDate: new Date('2025-09-25'),
      category: 'ANTIHISTAMINES'
    },
    {
      name: 'Ciprofloxacin 500mg',
      genericName: 'Ciprofloxacin',
      batchNumber: 'BATCH008',
      quantity: 150,
      unitPrice: 35,
      expiryDate: new Date('2025-07-18'),
      category: 'ANTIBIOTICS'
    },
    {
      name: 'Vitamin C 1000mg',
      genericName: 'Ascorbic Acid',
      batchNumber: 'BATCH009',
      quantity: 600,
      unitPrice: 8,
      expiryDate: new Date('2026-06-30'),
      category: 'VITAMINS'
    },
    {
      name: 'Amlodipine 5mg',
      genericName: 'Amlodipine',
      batchNumber: 'BATCH010',
      quantity: 220,
      unitPrice: 19,
      expiryDate: new Date('2025-12-05'),
      category: 'ANTIHYPERTENSIVES'
    }
  ];

  for (const medicine of medicines) {
    const created = await prisma.medicine.create({
      data: medicine
    });
    console.log(`✓ Created medicine: ${created.name}`);
  }

  // Create sample customer
  const customer = await prisma.customer.create({
    data: {
      name: 'John Doe',
      phone: '+254700000000',
      email: 'john.doe@example.com',
      loyaltyPoints: 50
    }
  });
  console.log('✓ Created sample customer:', customer.name);

  // Create sample supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: 'MediSupply Ltd',
      contactPerson: 'Jane Smith',
      phone: '+254711111111',
      email: 'contact@medisupply.com',
      address: '123 Industrial Area, Nairobi'
    }
  });
  console.log('✓ Created sample supplier:', supplier.name);

  console.log('\n✅ Test database seeded successfully!');
  console.log(`📁 Database location: ${TEST_DB_PATH}`);
  console.log('\n🔑 Test Credentials:');
  console.log('   Admin: admin@dawacare.local / admin123');
  console.log('   Cashier: cashier@dawacare.local / cashier123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
