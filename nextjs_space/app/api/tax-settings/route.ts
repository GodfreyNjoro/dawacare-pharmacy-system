import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Tax setting keys
const TAX_SETTINGS_KEYS = [
  'vat_enabled',
  'standard_vat_rate',
  'company_kra_pin',
  'company_name',
  'company_address',
  'company_phone',
  'company_email',
  'default_tax_exempt',
];

// Default tax settings
const DEFAULT_TAX_SETTINGS = {
  vat_enabled: 'true',
  standard_vat_rate: '16',
  company_kra_pin: '',
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  default_tax_exempt: 'true',
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all tax-related settings
    const settings = await prisma.appSettings.findMany({
      where: {
        category: 'tax',
      },
    });

    // Convert to key-value object, using defaults for missing values
    const settingsObj: Record<string, string> = { ...DEFAULT_TAX_SETTINGS };
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });

    // Return formatted for frontend use
    return NextResponse.json({
      vatEnabled: settingsObj.vat_enabled === 'true',
      standardVatRate: parseFloat(settingsObj.standard_vat_rate) || 16,
      companyKraPin: settingsObj.company_kra_pin,
      companyName: settingsObj.company_name,
      companyAddress: settingsObj.company_address,
      companyPhone: settingsObj.company_phone,
      companyEmail: settingsObj.company_email,
      defaultTaxExempt: settingsObj.default_tax_exempt === 'true',
    });
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (ADMIN or PHARMACIST)
    const userRole = (session.user as { role?: string }).role;
    if (!userRole || !['ADMIN', 'PHARMACIST'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only Admin or Pharmacist can modify tax settings.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      vatEnabled,
      standardVatRate,
      companyKraPin,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      defaultTaxExempt,
    } = body;

    // Prepare settings to upsert
    const settingsToSave = [
      { key: 'vat_enabled', value: String(vatEnabled ?? true), description: 'Enable/disable VAT calculation' },
      { key: 'standard_vat_rate', value: String(standardVatRate ?? 16), description: 'Standard VAT rate percentage (Kenya: 16%)' },
      { key: 'company_kra_pin', value: companyKraPin ?? '', description: 'Company KRA PIN for tax invoices' },
      { key: 'company_name', value: companyName ?? '', description: 'Company name for tax documents' },
      { key: 'company_address', value: companyAddress ?? '', description: 'Company address for tax documents' },
      { key: 'company_phone', value: companyPhone ?? '', description: 'Company phone number' },
      { key: 'company_email', value: companyEmail ?? '', description: 'Company email address' },
      { key: 'default_tax_exempt', value: String(defaultTaxExempt ?? true), description: 'Default medicines to VAT exempt' },
    ];

    // Use transaction to update all settings
    const userName = (session.user as { name?: string }).name || session.user.email || 'Unknown';
    const userId = (session.user as { id?: string }).id || 'unknown';

    await prisma.$transaction(
      settingsToSave.map((setting) =>
        prisma.appSettings.upsert({
          where: { key: setting.key },
          update: {
            value: setting.value,
            updatedBy: userId,
            updatedByName: userName,
          },
          create: {
            key: setting.key,
            value: setting.value,
            category: 'tax',
            description: setting.description,
            updatedBy: userId,
            updatedByName: userName,
          },
        })
      )
    );

    // Log the audit trail
    try {
      await prisma.auditLog.create({
        data: {
          entityType: 'TAX_SETTINGS',
          entityId: 'global',
          action: 'UPDATE',
          userId: userId,
          userName: userName,
          userEmail: session.user.email || '',
          userRole: userRole,
          entityName: 'Tax Settings',
          newValues: JSON.stringify({
            vatEnabled,
            standardVatRate,
            companyKraPin: companyKraPin ? '****' : '',
            companyName,
            defaultTaxExempt,
          }),
        },
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Tax settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to save tax settings' },
      { status: 500 }
    );
  }
}
