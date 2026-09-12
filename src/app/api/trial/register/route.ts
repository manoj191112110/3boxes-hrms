import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * POST /api/trial/register
 * Public endpoint — companies register for a trial.
 * Now includes: selectedModules, companyLogo, employeeDataJson
 * Auto-approves and creates full tenant structure immediately.
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const body = await request.json();
    const {
      companyName,
      companyCode,
      companyEmail,
      companyPhone,
      companyWebsite,
      industry,
      country,
      currency,
      employeeCount,
      contactName,
      contactEmail,
      contactPhone,
      designation,
      address,
      city,
      state,
      zipCode,
      selectedModules,
      companyLogo,
      employeeDataJson,
    } = body;

    // Validate required fields
    if (!companyName || !companyCode || !companyEmail || !contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, companyCode, companyEmail, contactName, contactEmail' },
        { status: 400 }
      );
    }

    // Normalize companyCode to slug-safe format
    const slug = companyCode
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if companyCode/slug already exists as a tenant
    const existingTenant = await db.tenant.findFirst({
      where: { slug },
    });
    if (existingTenant) {
      return NextResponse.json(
        { error: `Company code "${slug}" is already taken. Please choose a different one.` },
        { status: 409 }
      );
    }

    // Check if companyEmail already registered
    const existingRegByEmail = await db.trialRegistration.findFirst({
      where: { companyEmail },
    });
    if (existingRegByEmail) {
      return NextResponse.json(
        { error: 'This company email is already registered for a trial.' },
        { status: 409 }
      );
    }

    // Check if contactEmail already registered
    const existingRegByContact = await db.trialRegistration.findFirst({
      where: { contactEmail },
    });
    if (existingRegByContact) {
      return NextResponse.json(
        { error: 'This contact email is already registered for a trial.' },
        { status: 409 }
      );
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8-char alphanumeric
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const now = new Date();
    const trialDays = 15;
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    // Create the full tenant structure in a transaction
    const result = await db.$transaction(async (tx: any) => {
      // 1. Create the trial registration record
      const registration = await tx.trialRegistration.create({
        data: {
          companyName,
          companyCode: slug,
          companyEmail,
          companyPhone: companyPhone || null,
          companyWebsite: companyWebsite || null,
          industry: industry || null,
          country: country || 'IN',
          currency: currency || 'INR',
          employeeCount: employeeCount || 10,
          contactName,
          contactEmail,
          contactPhone: contactPhone || null,
          designation: designation || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          selectedModules: selectedModules ? selectedModules.join(',') : null,
          companyLogo: companyLogo || null,
          employeeDataJson: employeeDataJson || null,
          status: 'pending', // Requires super admin approval before activation
          trialDays,
          trialStart: null, // Set when approved
          trialEnd: null,   // Set when approved
          tempPassword,
        },
      });

      return { registration, companyCode: slug };
    });

    return NextResponse.json({
      message: 'Trial registration submitted! Our team will review your request and activate your trial within 24 hours.',
      registrationId: result.registration.id,
      companyCode: result.companyCode,
      autoApproved: false,
      contactEmail,
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Trial Register] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}
