import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Fetch single entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    const entry = await prisma.controlledSubstanceRegister.findUnique({
      where: { id },
      include: {
        medicine: true
      }
    });
    
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching entry:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

// PUT - Verify entry (second pharmacist verification)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userRole = (session.user as { role?: string }).role || 'CASHIER';
    if (!['ADMIN', 'PHARMACIST'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only pharmacists or administrators can verify entries' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    
    const entry = await prisma.controlledSubstanceRegister.findUnique({
      where: { id }
    });
    
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    
    if (action === 'verify') {
      // Cannot verify own entry
      if (entry.recordedBy === session.user.id) {
        return NextResponse.json(
          { error: 'Cannot verify your own entry. Another pharmacist must verify.' },
          { status: 400 }
        );
      }
      
      if (entry.verifiedBy) {
        return NextResponse.json(
          { error: 'Entry already verified' },
          { status: 400 }
        );
      }
      
      const updated = await prisma.controlledSubstanceRegister.update({
        where: { id },
        data: {
          verifiedBy: session.user.id,
          verifiedByName: session.user.name || 'Unknown',
          verifiedAt: new Date()
        },
        include: {
          medicine: true
        }
      });
      
      return NextResponse.json(updated);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}
