import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_TTL = 60; // 60 seconds

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Check cache
    const cacheKey = `invoice:stats:${membership.organizationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // Get all invoices for this organization from the Invoice table
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const totalInvoices = invoices.length;
    let totalAmount = 0;
    let approved = 0;
    let pendingReview = 0;
    let rejected = 0;
    let flagged = 0;

    const vendorMap = new Map<string, { count: number; amount: number }>();
    const monthlyMap = new Map<string, { count: number; amount: number }>();
    const statusMap = new Map<string, { count: number; amount: number }>();
    const categoryMap = new Map<string, { count: number; amount: number }>();

    // Track currency for display
    let primaryCurrency = 'USD';
    const currencyCounts: Record<string, number> = {};

    invoices.forEach((invoice) => {
      // Amount calculations - use total field which has the extracted amount
      const amount = invoice.total || invoice.amount || 0;
      const currency = invoice.currency || 'USD';
      
      // Track currency frequency to determine primary
      currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
      
      // Convert to USD for aggregation (simplified)
      let normalizedAmount = amount;
      if (currency === 'INR') normalizedAmount = amount / 83;
      if (currency === 'EUR') normalizedAmount = amount * 1.08;
      
      totalAmount += normalizedAmount;

      // Reimbursement status
      const reimbursable = invoice.reimbursable;
      switch (reimbursable) {
        case 'APPROVED': approved++; break;
        case 'REJECTED': rejected++; break;
        case 'NEEDS_REVIEW': flagged++; break;
        case 'PENDING': pendingReview++; break;
        default: pendingReview++;
      }

      // Status breakdown by reimbursable status (show in original currency)
      const currentStatus = statusMap.get(reimbursable) || { count: 0, amount: 0 };
      statusMap.set(reimbursable, {
        count: currentStatus.count + 1,
        amount: currentStatus.amount + amount, // Keep original currency for display
      });

      // Vendor aggregation
      const vendor = invoice.vendorName || 'Unknown';
      if (vendor && vendor !== 'Unknown') {
        const currentVendor = vendorMap.get(vendor) || { count: 0, amount: 0 };
        vendorMap.set(vendor, {
          count: currentVendor.count + 1,
          amount: currentVendor.amount + amount, // Keep original
        });
      }

      // Category aggregation
      const category = invoice.category || 'OTHER';
      const currentCategory = categoryMap.get(category) || { count: 0, amount: 0 };
      categoryMap.set(category, {
        count: currentCategory.count + 1,
        amount: currentCategory.amount + amount, // Keep original
      });

      // Monthly aggregation
      const month = invoice.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const currentMonth = monthlyMap.get(month) || { count: 0, amount: 0 };
      monthlyMap.set(month, {
        count: currentMonth.count + 1,
        amount: currentMonth.amount + normalizedAmount, // Normalized for trend
      });
    });

    // Determine primary currency (most frequent)
    primaryCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';

    // Convert maps to arrays and sort
    const topVendors = Array.from(vendorMap.entries())
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-12); // Last 12 months

    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.count - a.count);

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8); // Top 8 categories

    const result = {
      totalInvoices,
      totalAmount: Math.round(totalAmount * 100) / 100,
      averageAmount: totalInvoices > 0 ? Math.round((totalAmount / totalInvoices) * 100) / 100 : 0,
      primaryCurrency,
      pendingReview,
      approved,
      rejected,
      flagged,
      monthlyData,
      topVendors,
      statusBreakdown,
      categoryBreakdown,
    };
    
    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice stats' },
      { status: 500 }
    );
  }
}
