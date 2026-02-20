-- DropIndex
DROP INDEX "search_chunks_text_vector_idx";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "viewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "processing_stage" TEXT;

-- AlterTable
ALTER TABLE "search_chunks" ALTER COLUMN "parent_titles" DROP DEFAULT;

-- CreateTable
CREATE TABLE "document_shares" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "share_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pageindex_trees" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "tree_data" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pageindex_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adverse_media_checks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "input_type" TEXT NOT NULL,
    "raw_input" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "results" JSONB,
    "risk_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "adverse_media_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adverse_media_entities" (
    "id" TEXT NOT NULL,
    "check_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "industry" TEXT,
    "registration_num" TEXT,
    "match_confidence" DOUBLE PRECISION NOT NULL,
    "match_reasoning" TEXT,
    "riskScore" INTEGER NOT NULL,
    "risk_category" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "sanctions_count" INTEGER NOT NULL DEFAULT 0,
    "regulatory_count" INTEGER NOT NULL DEFAULT 0,
    "news_count" INTEGER NOT NULL DEFAULT 0,
    "web_count" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB,
    "raw_cache" JSONB,
    "cache_expires_at" TIMESTAMP(3),
    "is_monitored" BOOLEAN NOT NULL DEFAULT false,
    "last_monitored_at" TIMESTAMP(3),

    CONSTRAINT "adverse_media_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_shares_share_token_key" ON "document_shares"("share_token");

-- CreateIndex
CREATE INDEX "document_shares_share_token_idx" ON "document_shares"("share_token");

-- CreateIndex
CREATE INDEX "document_shares_document_id_idx" ON "document_shares"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "pageindex_trees_document_id_key" ON "pageindex_trees"("document_id");

-- CreateIndex
CREATE INDEX "pageindex_trees_document_id_idx" ON "pageindex_trees"("document_id");

-- CreateIndex
CREATE INDEX "adverse_media_checks_user_id_idx" ON "adverse_media_checks"("user_id");

-- CreateIndex
CREATE INDEX "adverse_media_checks_organization_id_idx" ON "adverse_media_checks"("organization_id");

-- CreateIndex
CREATE INDEX "adverse_media_checks_created_at_idx" ON "adverse_media_checks"("created_at");

-- CreateIndex
CREATE INDEX "adverse_media_checks_status_idx" ON "adverse_media_checks"("status");

-- CreateIndex
CREATE INDEX "adverse_media_entities_check_id_idx" ON "adverse_media_entities"("check_id");

-- CreateIndex
CREATE INDEX "adverse_media_entities_normalized_name_idx" ON "adverse_media_entities"("normalized_name");

-- CreateIndex
CREATE INDEX "adverse_media_entities_riskScore_idx" ON "adverse_media_entities"("riskScore");

-- CreateIndex
CREATE INDEX "adverse_media_entities_cache_expires_at_idx" ON "adverse_media_entities"("cache_expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_sessions_document_id_idx" ON "chat_sessions"("document_id");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "documents_matter_id_idx" ON "documents"("matter_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "extractions_document_id_idx" ON "extractions"("document_id");

-- CreateIndex
CREATE INDEX "matters_organization_id_idx" ON "matters"("organization_id");

-- CreateIndex
CREATE INDEX "messages_chat_session_id_idx" ON "messages"("chat_session_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "risks_document_id_idx" ON "risks"("document_id");

-- CreateIndex
CREATE INDEX "risks_document_id_status_idx" ON "risks"("document_id", "status");

-- CreateIndex
CREATE INDEX "search_chunks_text_vector_idx" ON "search_chunks"("text_vector");

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pageindex_trees" ADD CONSTRAINT "pageindex_trees_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_checks" ADD CONSTRAINT "adverse_media_checks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_checks" ADD CONSTRAINT "adverse_media_checks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_entities" ADD CONSTRAINT "adverse_media_entities_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "adverse_media_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
