-- CreateEnum
CREATE TYPE "AIInteractionType" AS ENUM ('GENERAL_QUESTION', 'FINANCIAL_ADVICE', 'BUDGET_PLANNING', 'INVESTMENT_ADVICE', 'DEBT_MANAGEMENT', 'SAVINGS_STRATEGY', 'TAX_ADVICE', 'INSURANCE_ADVICE', 'RETIREMENT_PLANNING', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialQueryCategory" AS ENUM ('BUDGETING', 'SAVING', 'INVESTING', 'DEBT', 'TAXES', 'INSURANCE', 'RETIREMENT', 'CREDIT', 'BANKING', 'CRYPTO', 'REAL_ESTATE', 'BUSINESS_FINANCE', 'EDUCATION_FINANCE', 'OTHER');

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "interactionType" "AIInteractionType" NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-3-haiku-20240307',
    "tokensUsed" INTEGER,
    "responseTime" INTEGER,
    "isFinancialQuery" BOOLEAN NOT NULL DEFAULT false,
    "queryCategory" "FinancialQueryCategory",
    "disclaimerShown" BOOLEAN NOT NULL DEFAULT false,
    "disclaimerVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
