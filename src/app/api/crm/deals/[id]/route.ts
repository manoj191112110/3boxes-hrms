import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Deals [id] API
   PUT / DELETE for individual deals.
   ─────────────────────────────────────────────────────────────── */

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, contact, company, value, stage, probability, closeDate, description } = body;

    if (!name || !value) {
      return NextResponse.json({ error: 'Deal name and value are required' }, { status: 400 });
    }

    // Demo: return updated deal
    const updated = {
      id: parseInt(id),
      name,
      contact: contact || '',
      company: company || '',
      value: parseInt(value) || 0,
      stage: stage || 'Qualification',
      probability: parseInt(probability) || 0,
      closeDate: closeDate || 'TBD',
      owner: 'Current User',
      description: description || '',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ deal: updated, message: 'Deal updated successfully' });
  } catch (error) {
    console.error('CRM Deals PUT error:', error);
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ message: `Deal ${id} deleted successfully` });
  } catch (error) {
    console.error('CRM Deals DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}
