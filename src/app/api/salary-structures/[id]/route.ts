import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;

    const salaryStructure = await db.salaryStructure.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        components: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!salaryStructure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404, headers: corsHeaders() });
    }

    return NextResponse.json({ salaryStructure }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get salary structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.salaryStructure.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    const fields = ['name', 'country', 'currency', 'description', 'status'];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const salaryStructure = await db.salaryStructure.update({
      where: { id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true } },
        components: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_SALARY_STRUCTURE',
        module: 'salary-structures',
        details: `Updated salary structure ${id}`,
      },
    });

    return NextResponse.json({ salaryStructure }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update salary structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, component } = body;

    const existing = await db.salaryStructure.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404, headers: corsHeaders() });
    }

    // action: 'add_component', 'update_component', 'remove_component'
    if (action === 'add_component' && component) {
      const maxSortOrder = await db.salaryComponent.findFirst({
        where: { salaryStructureId: id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      await db.salaryComponent.create({
        data: {
          salaryStructureId: id,
          name: component.name,
          type: component.type || 'earning',
          category: component.category || 'other',
          calculationType: component.calculationType || 'fixed',
          value: component.value ?? 0,
          percentageOf: component.percentageOf || null,
          formula: component.formula || null,
          isTaxable: component.isTaxable ?? true,
          isStatutory: component.isStatutory ?? false,
          maxLimit: component.maxLimit || null,
          sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
          status: 'active',
        },
      });
    } else if (action === 'update_component' && component) {
      if (!component.id) {
        return NextResponse.json(
          { error: 'Component id required for update' },
          { status: 400, headers: corsHeaders() }
        );
      }
      const compUpdateData: Record<string, unknown> = {};
      const compFields = ['name', 'type', 'category', 'calculationType', 'value', 'percentageOf', 'formula', 'isTaxable', 'isStatutory', 'maxLimit', 'sortOrder', 'status'];
      for (const field of compFields) {
        if (component[field] !== undefined) compUpdateData[field] = component[field];
      }
      await db.salaryComponent.update({
        where: { id: component.id },
        data: compUpdateData,
      });
    } else if (action === 'remove_component' && component?.id) {
      await db.salaryComponent.delete({
        where: { id: component.id },
      });
    } else {
      // Support field-level updates (name, country, currency, description, status, components)
      const updateData: Record<string, unknown> = {};
      const fields = ['name', 'country', 'currency', 'description', 'status'];
      for (const field of fields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (Object.keys(updateData).length > 0) {
        await db.salaryStructure.update({
          where: { id },
          data: updateData,
        });
      }

      // Handle components array replacement
      if (body.components && Array.isArray(body.components)) {
        // Delete existing components and recreate
        await db.salaryComponent.deleteMany({ where: { salaryStructureId: id } });
        for (let i = 0; i < body.components.length; i++) {
          const comp = body.components[i];
          await db.salaryComponent.create({
            data: {
              salaryStructureId: id,
              name: comp.name || '',
              type: comp.type || 'earning',
              category: comp.category || 'other',
              calculationType: comp.calculationType || 'fixed',
              value: comp.value ?? 0,
              percentageOf: comp.percentageOf || null,
              formula: comp.formula || null,
              isTaxable: comp.isTaxable ?? true,
              isStatutory: comp.isStatutory ?? false,
              maxLimit: comp.maxLimit || null,
              sortOrder: i,
              status: 'active',
            },
          });
        }
      }
    }

    const salaryStructure = await db.salaryStructure.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        components: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'UPDATE_SALARY_STRUCTURE_COMPONENTS',
        module: 'salary-structures',
        details: `${action || 'field_update'} on salary structure ${id}`,
      },
    });

    return NextResponse.json({ salaryStructure }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch salary structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;

    const existing = await db.salaryStructure.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Salary structure not found' }, { status: 404, headers: corsHeaders() });

    // Delete components first
    await db.salaryComponent.deleteMany({ where: { salaryStructureId: id } });
    // Delete the structure
    await db.salaryStructure.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_SALARY_STRUCTURE',
        module: 'salary-structures',
        details: `Deleted salary structure ${id}`,
      },
    });

    return NextResponse.json({ message: 'Salary structure deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete salary structure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
