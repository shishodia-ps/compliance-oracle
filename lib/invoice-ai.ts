import { prisma } from '@/lib/prisma';
import { ExpenseCategory, RiskLevel } from '@prisma/client';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_API_URL = 'https://api.moonshot.cn/v1/chat/completions';

export interface ExtractedInvoiceData {
  vendorName: string | null;
  vendorTaxId: string | null;
  vendorAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  subtotal: number | null;
  taxAmount: number | null;
  total: number | null;
  currency: string;
  category: ExpenseCategory;
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    amount: number | null;
  }>;
  // Employee info
  employeeName: string | null;
  employeeId: string | null;
  businessPurpose: string | null;
  // Location
  city: string | null;
  country: string | null;
}

export interface PolicyCheckResult {
  isWeekend: boolean;
  isAlcohol: boolean;
  isPersonalVendor: boolean;
  exceedsPolicy: boolean;
  missingTaxVat: boolean;
  missingInvoiceNumber: boolean;
  missingBusinessPurpose: boolean;
  outsideTravelPolicy: boolean;
  luxuryHotel: boolean;
  fiveStarDining: boolean;
  amountTooHigh: boolean;
  unusualCountry: boolean;
}

export interface RiskFlag {
  type: string;
  severity: RiskLevel;
  title: string;
  description: string;
}

export interface AnalysisResult {
  extracted: ExtractedInvoiceData;
  policyChecks: PolicyCheckResult;
  riskFlags: RiskFlag[];
  riskScore: number;
  riskLevel: RiskLevel;
  reimbursable: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';
  decisionReason: string;
  duplicateOf?: string;
  patternFlags: string[];
}

/**
 * Extract all invoice data using AI
 */
export async function extractInvoiceDataWithAI(text: string): Promise<ExtractedInvoiceData> {
  const defaultData: ExtractedInvoiceData = {
    vendorName: null,
    vendorTaxId: null,
    vendorAddress: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    subtotal: null,
    taxAmount: null,
    total: null,
    currency: 'EUR',
    category: 'OTHER' as ExpenseCategory,
    lineItems: [],
    employeeName: null,
    employeeId: null,
    businessPurpose: null,
    city: null,
    country: null,
  };

  if (!MOONSHOT_API_KEY) {
    console.warn('MOONSHOT_API_KEY not set, using default extraction');
    return defaultData;
  }

  try {
    const response = await fetch(MOONSHOT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          {
            role: 'system',
            content: `You are an expert invoice data extraction AI. Extract ALL possible information from this invoice.

Return JSON with these fields:
{
  "vendorName": "Company name",
  "vendorTaxId": "Tax/VAT number or null",
  "vendorAddress": "Full address or null",
  "invoiceNumber": "Invoice number string",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": 100.00,
  "taxAmount": 20.00,
  "total": 120.00,
  "currency": "EUR",
  "category": "One of: TRAVEL, HOTEL, FOOD, CLIENT_ENTERTAINMENT, OFFICE_SUPPLIES, SOFTWARE, TRANSPORT, MEDICAL, OTHER",
  "lineItems": [{"description": "Item", "quantity": 1, "unitPrice": 100, "amount": 100}],
  "employeeName": "Employee name if mentioned",
  "employeeId": "Employee ID if mentioned",
  "businessPurpose": "Business purpose if stated",
  "city": "City",
  "country": "Country"
}

Extract ALL numerical values as numbers (not strings). Use null for missing fields.`,
          },
          {
            role: 'user',
            content: `Extract invoice data from this text:\n\n${text.substring(0, 20000)}`,
          },
        ],
        temperature: 1,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const data = JSON.parse(result.choices[0].message.content);

    return {
      vendorName: data.vendorName || null,
      vendorTaxId: data.vendorTaxId || null,
      vendorAddress: data.vendorAddress || null,
      invoiceNumber: data.invoiceNumber || null,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      subtotal: typeof data.subtotal === 'number' ? data.subtotal : null,
      taxAmount: typeof data.taxAmount === 'number' ? data.taxAmount : null,
      total: typeof data.total === 'number' ? data.total : null,
      currency: data.currency || 'EUR',
      category: (data.category || 'OTHER') as ExpenseCategory,
      lineItems: (data.lineItems || []).map((item: any) => ({
        description: item.description || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
        amount: typeof item.amount === 'number' ? item.amount : null,
      })),
      employeeName: data.employeeName || null,
      employeeId: data.employeeId || null,
      businessPurpose: data.businessPurpose || null,
      city: data.city || null,
      country: data.country || null,
    };
  } catch (error) {
    console.error('AI extraction failed:', error);
    return defaultData;
  }
}

/**
 * Run all policy checks
 */
export async function runPolicyChecks(
  data: ExtractedInvoiceData,
  organizationId: string
): Promise<PolicyCheckResult> {
  const checks: PolicyCheckResult = {
    isWeekend: false,
    isAlcohol: false,
    isPersonalVendor: false,
    exceedsPolicy: false,
    missingTaxVat: !data.vendorTaxId,
    missingInvoiceNumber: !data.invoiceNumber,
    missingBusinessPurpose: !data.businessPurpose,
    outsideTravelPolicy: false,
    luxuryHotel: false,
    fiveStarDining: false,
    amountTooHigh: false,
    unusualCountry: false,
  };

  // Weekend check
  if (data.invoiceDate) {
    const day = data.invoiceDate.getDay();
    checks.isWeekend = day === 0 || day === 6;
  }

  // Amount checks
  const amount = data.total || 0;
  checks.amountTooHigh = amount > 1000;

  // Category-specific checks
  const vendorNameLower = (data.vendorName || '').toLowerCase();
  const category = data.category;

  // Alcohol detection
  const alcoholKeywords = ['alcohol', 'wine', 'beer', 'spirits', 'liquor', 'bar', 'pub'];
  checks.isAlcohol = alcoholKeywords.some(kw => vendorNameLower.includes(kw));

  // Luxury detection
  checks.luxuryHotel = category === 'HOTEL' && amount > 300;
  checks.fiveStarDining = category === 'FOOD' && amount > 150;

  // Personal vendor detection
  const personalVendors = ['personal', 'private', 'family'];
  checks.isPersonalVendor = personalVendors.some(kw => vendorNameLower.includes(kw));

  // Travel policy check
  checks.outsideTravelPolicy = category === 'TRAVEL' && amount > 500;

  // Unusual country (simplified - would need country list)
  checks.unusualCountry = !!data.country && !['Netherlands', 'Germany', 'Belgium', 'France', 'UK'].includes(data.country);

  return checks;
}

/**
 * Detect patterns (duplicates, splits, outliers)
 */
export async function detectPatterns(
  data: ExtractedInvoiceData,
  invoiceId: string,
  organizationId: string
): Promise<{ flags: RiskFlag[]; duplicateOf?: string; patternFlags: string[] }> {
  const flags: RiskFlag[] = [];
  const patternFlags: string[] = [];
  let duplicateOf: string | undefined;

  // Check for duplicates
  const duplicates = await prisma.invoice.findMany({
    where: {
      organizationId,
      id: { not: invoiceId },
      OR: [
        { invoiceNumber: data.invoiceNumber },
        {
          AND: [
            { total: { equals: data.total } },
            { vendorName: { equals: data.vendorName, mode: 'insensitive' } },
            { invoiceDate: { equals: data.invoiceDate } },
          ],
        },
      ],
    },
    take: 1,
  });

  if (duplicates.length > 0) {
    duplicateOf = duplicates[0].id;
    flags.push({
      type: 'DUPLICATE',
      severity: 'HIGH',
      title: 'Duplicate Invoice Detected',
      description: `This invoice matches ${duplicates[0].invoiceNumber || 'another invoice'} with the same amount and vendor.`,
    });
    patternFlags.push('duplicate_invoice');
  }

  // Check for split expenses (same vendor, same day, similar amounts)
  if (data.vendorName && data.invoiceDate) {
    const sameDayInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        id: { not: invoiceId },
        vendorName: { equals: data.vendorName, mode: 'insensitive' },
        invoiceDate: { equals: data.invoiceDate },
      },
    });

    if (sameDayInvoices.length > 0) {
      const totalSameDay = sameDayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      if (totalSameDay > 200) {
        flags.push({
          type: 'SPLIT_EXPENSE',
          severity: 'MEDIUM',
          title: 'Possible Split Expense',
          description: `Multiple invoices from same vendor on same day totaling €${totalSameDay.toFixed(2)}`,
        });
        patternFlags.push('split_expense');
      }
    }
  }

  // Check for daily repeats
  if (data.vendorName) {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        id: { not: invoiceId },
        vendorName: { equals: data.vendorName, mode: 'insensitive' },
        createdAt: { gte: last7Days },
      },
    });

    if (recentInvoices.length >= 3) {
      flags.push({
        type: 'REPEATED_VENDOR',
        severity: 'LOW',
        title: 'Frequent Vendor Usage',
        description: `This vendor has been used ${recentInvoices.length} times in the last 7 days`,
      });
      patternFlags.push('frequent_vendor');
    }
  }

  return { flags, duplicateOf, patternFlags };
}

/**
 * Calculate risk score and level
 */
export function calculateRisk(
  policyChecks: PolicyCheckResult,
  patternFlags: string[],
  flags: RiskFlag[],
  category: string
): { score: number; level: RiskLevel; reimbursable: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW'; reason: string } {
  let score = 0;
  const violations: string[] = [];

  // Policy violations
  if (policyChecks.isAlcohol) { score += 30; violations.push('Alcohol not reimbursable'); }
  if (policyChecks.isWeekend && category === 'OFFICE_SUPPLIES') { score += 20; violations.push('Weekend business expense'); }
  if (policyChecks.amountTooHigh) { score += 25; violations.push('Amount exceeds typical threshold'); }
  if (policyChecks.luxuryHotel) { score += 20; violations.push('Luxury hotel expense'); }
  if (policyChecks.fiveStarDining) { score += 20; violations.push('High-end dining expense'); }
  if (policyChecks.missingBusinessPurpose) { score += 15; violations.push('Missing business purpose'); }
  if (policyChecks.missingInvoiceNumber) { score += 10; violations.push('Missing invoice number'); }
  if (policyChecks.missingTaxVat) { score += 10; violations.push('Missing tax/VAT number'); }
  if (policyChecks.isPersonalVendor) { score += 40; violations.push('Personal vendor detected'); }

  // Pattern violations
  if (patternFlags.includes('duplicate_invoice')) { score += 50; violations.push('Duplicate invoice'); }
  if (patternFlags.includes('split_expense')) { score += 35; violations.push('Possible split expense (policy bypass)'); }

  // Determine level
  let level: RiskLevel = 'LOW';
  if (score >= 80) level = 'CRITICAL';
  else if (score >= 60) level = 'HIGH';
  else if (score >= 30) level = 'MEDIUM';

  // Determine decision
  let reimbursable: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' = 'APPROVED';
  let reason = 'Within policy limits';

  if (score >= 70) {
    reimbursable = 'REJECTED';
    reason = violations.slice(0, 3).join('; ');
  } else if (score >= 30 || violations.length > 0) {
    reimbursable = 'NEEDS_REVIEW';
    reason = violations.slice(0, 2).join('; ') || 'Requires manual review';
  }

  return { score, level, reimbursable, reason };
}

/**
 * Full invoice analysis pipeline
 */
export async function analyzeInvoiceFull(
  text: string,
  invoiceId: string,
  organizationId: string
): Promise<AnalysisResult> {
  // Step 1: Extract data
  const extracted = await extractInvoiceDataWithAI(text);

  // Step 2: Policy checks
  const policyChecks = await runPolicyChecks(extracted, organizationId);

  // Step 3: Pattern detection
  const { flags, duplicateOf, patternFlags } = await detectPatterns(extracted, invoiceId, organizationId);

  // Step 4: Calculate risk
  const { score, level, reimbursable, reason } = calculateRisk(policyChecks, patternFlags, flags, extracted.category);

  // Add policy flags
  if (policyChecks.isAlcohol) {
    flags.push({ type: 'ALCOHOL', severity: 'HIGH', title: 'Alcohol Expense', description: 'Alcohol expenses are not reimbursable per company policy' });
  }
  if (policyChecks.isWeekend) {
    flags.push({ type: 'WEEKEND', severity: 'LOW', title: 'Weekend Expense', description: 'Expense incurred on weekend - verify business purpose' });
  }
  if (policyChecks.amountTooHigh) {
    flags.push({ type: 'HIGH_AMOUNT', severity: 'MEDIUM', title: 'High Amount', description: `Amount €${extracted.total} exceeds typical threshold` });
  }

  return {
    extracted,
    policyChecks,
    riskFlags: flags,
    riskScore: score,
    riskLevel: level,
    reimbursable,
    decisionReason: reason,
    duplicateOf,
    patternFlags,
  };
}
