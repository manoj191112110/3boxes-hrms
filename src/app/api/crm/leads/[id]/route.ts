import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Leads [id] API
   PUT / DELETE for individual leads.
   ─────────────────────────────────────────────────────────────── */

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, email, phone, company, source, status, score, notes } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    const parsedScore = parseInt(score) || 50;
    const temperature = parsedScore >= 70 ? 'Hot' : parsedScore >= 40 ? 'Warm' : 'Cold';

    // Demo: return updated lead
    const updated = {
      id: parseInt(id),
      firstName,
      lastName,
      email,
      phone: phone || '',
      company: company || '',
      source: source || 'Website',
      status: status || 'New',
      score: parsedScore,
      temperature,
      notes: notes || '',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ lead: updated, message: 'Lead updated successfully' });
  } catch (error) {
    console.error('CRM Leads PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ message: `Lead ${id} deleted successfully` });
  } catch (error) {
    console.error('CRM Leads DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
