import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from './prisma';
import { AuthError, TokenExpiredError, formatErrorResponse } from './errors';

// In-memory token blacklist (use Redis in production)
const tokenBlacklist = new Set<string>();

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  return tokenBlacklist.has(tokenId);
}

/**
 * Blacklist a token (for logout)
 */
export async function blacklistToken(tokenId: string): Promise<void> {
  tokenBlacklist.add(tokenId);
  
  // Clean up old entries periodically (in production, use Redis TTL)
  if (tokenBlacklist.size > 10000) {
    const entries = Array.from(tokenBlacklist).slice(0, 1000);
    entries.forEach(id => tokenBlacklist.delete(id));
  }
}

/**
 * Validate session token with enhanced checks
 */
export async function validateAuth(
  request: NextRequest,
  options: {
    requireOrg?: boolean;
    allowedRoles?: string[];
  } = {}
) {
  const { requireOrg = true, allowedRoles } = options;
  
  try {
    // Get token from NextAuth
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (!token) {
      throw new AuthError('No valid session found');
    }
    
    // Check token expiry
    if (token.exp && typeof token.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (token.exp < now) {
        throw new TokenExpiredError();
      }
    }
    
    // Check blacklist (if token has a jti)
    if (token.jti && typeof token.jti === 'string' && await isTokenBlacklisted(token.jti)) {
      throw new AuthError('Session has been invalidated');
    }
    
    // Get user from database to verify they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: token.sub as string },
      select: { 
        id: true, 
        email: true, 
        role: true,
        memberships: {
          select: {
            organizationId: true,
            role: true,
          },
        },
      },
    });
    
    if (!user) {
      throw new AuthError('User not found');
    }
    
    // Check role permissions
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new AuthError(
        'Insufficient permissions',
        undefined,
        { requiredRoles: allowedRoles, userRole: user.role }
      );
    }
    
    // Get organization membership
    const membership = user.memberships[0];
    if (requireOrg && !membership) {
      throw new AuthError('No organization membership found');
    }
    
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: membership?.organizationId,
      membershipRole: membership?.role,
      token,
    };
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Handle JWT validation errors
    if (error instanceof Error) {
      if (error.message?.includes('expired')) {
        throw new TokenExpiredError();
      }
      if (error.message?.includes('invalid')) {
        throw new AuthError('Invalid session', undefined, { reason: 'invalid_token' });
      }
    }
    
    throw new AuthError('Authentication failed');
  }
}

/**
 * Middleware wrapper for API routes
 */
export function withAuth(
  handler: (req: NextRequest, auth: any) => Promise<NextResponse>,
  options: {
    requireOrg?: boolean;
    allowedRoles?: string[];
  } = {}
) {
  return async (request: NextRequest) => {
    try {
      const auth = await validateAuth(request, options);
      return await handler(request, auth);
    } catch (error) {
      const { error: message, code, statusCode, details } = formatErrorResponse(error as Error);
      
      return NextResponse.json(
        { error: message, code, details },
        { status: statusCode }
      );
    }
  };
}

/**
 * Check if user has required permissions
 */
export function requirePermission(
  userRole: string,
  requiredPermission: 'read' | 'write' | 'delete' | 'admin'
): boolean {
  const permissions: Record<string, string[]> = {
    'VIEWER': ['read'],
    'REVIEWER': ['read', 'write'],
    'MANAGER': ['read', 'write', 'delete'],
    'ADMIN': ['read', 'write', 'delete', 'admin'],
  };
  
  const userPermissions = permissions[userRole] || [];
  return userPermissions.includes(requiredPermission);
}
