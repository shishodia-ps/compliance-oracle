-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UPLOADED', 'PARSING', 'EXTRACTED', 'CLASSIFIED', 'ANALYZED', 'ERROR');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'HOTEL', 'FOOD', 'CLIENT_ENTERTAINMENT', 'OFFICE_SUPPLIES', 'SOFTWARE', 'TRANSPORT', 'MEDICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_REVIEW', 'PENDING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "document_id" TEXT,
    "vendor_name" TEXT,
    "vendor_id" TEXT,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "tax_amount" DOUBLE PRECISION,
    "vat_rate" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "category" "ExpenseCategory" DEFAULT 'OTHER',
    "expense_type" TEXT,
    "city" TEXT,
    "country" TEXT,
    "employee_name" TEXT,
    "employee_id" TEXT,
    "business_purpose" TEXT,
    "reimbursable" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING',
    "reimbursement_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UPLOADED',
    "processing_error" TEXT,
    "raw_extraction" JSONB,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "duplicate_of_id" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit_price" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "tax_rate" DOUBLE PRECISION,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "vat_number" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "first_seen" TIMESTAMP(3),
    "last_seen" TIMESTAMP(3),
    "auto_category" "ExpenseCategory",
    "classification_keywords" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_risk_flags" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "related_invoice_id" TEXT,
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_expense_summaries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category_breakdown" JSONB,
    "high_risk_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_expense_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_document_id_key" ON "invoices"("document_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_uploaded_by_id_idx" ON "invoices"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "invoices_vendor_id_idx" ON "invoices"("vendor_id");

-- CreateIndex
CREATE INDEX "invoices_vendor_name_idx" ON "invoices"("vendor_name");

-- CreateIndex
CREATE INDEX "invoices_invoice_date_idx" ON "invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "invoices_category_idx" ON "invoices"("category");

-- CreateIndex
CREATE INDEX "invoices_reimbursable_idx" ON "invoices"("reimbursable");

-- CreateIndex
CREATE INDEX "invoices_risk_level_idx" ON "invoices"("risk_level");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_idx" ON "vendors"("organization_id");

-- CreateIndex
CREATE INDEX "vendors_normalized_name_idx" ON "vendors"("normalized_name");

-- CreateIndex
CREATE INDEX "vendors_category_idx" ON "vendors"("category");

-- CreateIndex
CREATE INDEX "vendors_risk_level_idx" ON "vendors"("risk_level");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_id_normalized_name_key" ON "vendors"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "invoice_risk_flags_invoice_id_idx" ON "invoice_risk_flags"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_risk_flags_flag_type_idx" ON "invoice_risk_flags"("flag_type");

-- CreateIndex
CREATE INDEX "invoice_risk_flags_severity_idx" ON "invoice_risk_flags"("severity");

-- CreateIndex
CREATE INDEX "invoice_risk_flags_is_reviewed_idx" ON "invoice_risk_flags"("is_reviewed");

-- CreateIndex
CREATE INDEX "employee_expense_summaries_organization_id_idx" ON "employee_expense_summaries"("organization_id");

-- CreateIndex
CREATE INDEX "employee_expense_summaries_employee_id_idx" ON "employee_expense_summaries"("employee_id");

-- CreateIndex
CREATE INDEX "employee_expense_summaries_month_idx" ON "employee_expense_summaries"("month");

-- CreateIndex
CREATE UNIQUE INDEX "employee_expense_summaries_organization_id_employee_id_mont_key" ON "employee_expense_summaries"("organization_id", "employee_id", "month");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_risk_flags" ADD CONSTRAINT "invoice_risk_flags_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_risk_flags" ADD CONSTRAINT "invoice_risk_flags_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_risk_flags" ADD CONSTRAINT "invoice_risk_flags_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
