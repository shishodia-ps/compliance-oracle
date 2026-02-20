/**
 * Example of using enhanced auth middleware
 * This demonstrates proper error handling patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requirePermission } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET handler with auth middleware
 */
export const GET = withAuth(async (req: NextRequest, auth: any) => {
  const { userId, organizationId, role } = auth;
  
  if (!requirePermission(role, 'read')) {
    return NextResponse.json(
      { 
        error: 'Insufficient permissions', 
        code: 'FORBIDDEN',
        details: { required: 'read', userRole: role }
      },
      { status: 403 }
    );
  }
  
  const data = await prisma.document.findMany({
    where: { organizationId },
    take: 10,
  });
  
  return NextResponse.json({
    success: true,
    data,
    meta: { userId, organizationId }
  });
});

/**
 * POST handler with role restrictions
 */
export const POST = withAuth(
  async (req: NextRequest, auth: any) => {
    const { organizationId } = auth;
    const body = await req.json();
    
    const created = await prisma.document.create({
      data: { ...body, organizationId },
    });
    
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  },
  { allowedRoles: ['ADMIN', 'MANAGER'] }
);
