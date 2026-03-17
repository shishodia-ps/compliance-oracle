import { PrismaClient } from '@prisma/client';
import { extractCitations } from '../lib/appeal-ai/citation-extractor';

const prisma = new PrismaClient();

async function backfillCitations() {
    console.log('Fetching all cases...');
    const cases = await prisma.appealCase.findMany();

    for (const appealCase of cases) {
        console.log(`Processing Case ${appealCase.caseNumber}...`);

        const fullText = [appealCase.denialText, appealCase.appealText]
            .filter(Boolean)
            .join('\\n\\n--- APPEAL SUBMISSION ---\\n\\n');

        const linkedCitations = await extractCitations(fullText, `citations-${appealCase.id}`);

        // Delete existing citations for reruns
        await prisma.appealCitation.deleteMany({ where: { caseId: appealCase.id } });

        // Store all extracted citations
        if (linkedCitations.length > 0) {
            await prisma.appealCitation.createMany({
                data: linkedCitations.map(c => ({
                    caseId: appealCase.id,
                    citationType: c.type,
                    extractedText: c.extractedText,
                    normalizedRef: c.normalizedRef,
                    linkedNodeId: c.linkedNodeId,
                    confidence: c.confidence,
                    verified: false,
                })),
            });
            console.log(`  ✅ Saved ${linkedCitations.length} citations.`);
        } else {
            console.log(`  ❌ No citations found.`);
        }
    }
}

backfillCitations()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
