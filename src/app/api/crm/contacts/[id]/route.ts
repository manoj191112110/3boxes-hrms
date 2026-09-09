import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Contacts [id] API
   PUT / DELETE for individual contacts.
   ─────────────────────────────────────────────────────────────── */

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, email, phone, company, title, type, status, source } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    // Demo: return updated contact
    const updated = {
      id: parseInt(id),
      firstName,
      lastName,
      email,
      phone: phone || '',
      company: company || '',
      title: title || '',
      type: type || 'Lead',
      status: status || 'Active',
      source: source || 'website',
      lastContact: 'Just now',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ contact: updated, message: 'Contact updated successfully' });
  } catch (error) {
    console.error('CRM Contacts PUT error:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Demo: acknowledge deletion
    return NextResponse.json({ message: `Contact ${id} deleted successfully` });
  } catch (error) {
    console.error('CRM Contacts DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
