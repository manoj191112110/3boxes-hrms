import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Contacts API
   CRUD operations for CRM contacts.
   ─────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'All';
    const status = searchParams.get('status') || 'All';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Demo data — in production, query from database
    const contacts = [
      { id: 1, firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh@techvista.com', phone: '+91 98765 43210', company: 'TechVista Solutions', title: 'CTO', type: 'Customer', status: 'Active', lastContact: '2 hours ago', dealCount: 4, totalDealValue: 8200000 },
      { id: 2, firstName: 'Sneha', lastName: 'Iyer', email: 'sneha@datacore.com', phone: '+91 87654 32109', company: 'DataCore Inc.', title: 'VP Engineering', type: 'Lead', status: 'Active', lastContact: '4 hours ago', dealCount: 2, totalDealValue: 4500000 },
      { id: 3, firstName: 'Vikram', lastName: 'Patel', email: 'vikram@greenleaf.com', phone: '+91 76543 21098', company: 'GreenLeaf Corp.', title: 'Director of IT', type: 'Customer', status: 'Active', lastContact: 'Yesterday', dealCount: 6, totalDealValue: 15000000 },
      { id: 4, firstName: 'Priya', lastName: 'Sharma', email: 'priya@megasoft.com', phone: '+91 65432 10987', company: 'MegaSoft Ltd.', title: 'Head of Operations', type: 'Lead', status: 'Active', lastContact: '2 days ago', dealCount: 1, totalDealValue: 1900000 },
      { id: 5, firstName: 'Amit', lastName: 'Desai', email: 'amit@buildright.com', phone: '+91 54321 09876', company: 'BuildRight Inc.', title: 'CEO', type: 'Partner', status: 'Active', lastContact: '3 days ago', dealCount: 3, totalDealValue: 6500000 },
      { id: 6, firstName: 'Kavita', lastName: 'Nair', email: 'kavita@skyhigh.com', phone: '+91 43210 98765', company: 'SkyHigh Tech', title: 'Procurement Head', type: 'Vendor', status: 'Inactive', lastContact: '1 week ago', dealCount: 0, totalDealValue: 0 },
    ];

    let filtered = contacts;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    if (type !== 'All') filtered = filtered.filter(c => c.type === type);
    if (status !== 'All') filtered = filtered.filter(c => c.status === status);

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return NextResponse.json({
      contacts: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    });
  } catch (error) {
    console.error('CRM Contacts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, company, title, type, address, linkedin, website, notes } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    // Demo: return created contact with generated ID
    const newContact = {
      id: Date.now(),
      firstName,
      lastName,
      email,
      phone: phone || '',
      company: company || '',
      title: title || '',
      type: type || 'Lead',
      status: 'Active',
      address: address || '',
      linkedin: linkedin || '',
      website: website || '',
      notes: notes || '',
      lastContact: 'Just now',
      createdAt: new Date().toISOString().split('T')[0],
      dealCount: 0,
      totalDealValue: 0,
    };

    return NextResponse.json({ contact: newContact, message: 'Contact created successfully' }, { status: 201 });
  } catch (error) {
    console.error('CRM Contacts POST error:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
