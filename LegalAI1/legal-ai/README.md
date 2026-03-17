# Dutch Legal AI - Complete Data Ingestion System

This directory contains scripts for ingesting and categorizing Dutch legal data from official open data sources.

## 📚 Data Sources

### 1. Rechtspraak.nl (Case Law)
- **Source**: `https://data.rechtspraak.nl/`
- **Format**: XML via Open Data API
- **Identifiers**: ECLI (European Case Law Identifier)
- **Content**: Judgments, considerations (overwegingen), decisions
- **Rechtsgebieden**: Civiel recht, Strafrecht, Bestuursrecht, etc.

### 2. KOOP / BWB (Legislation)
- **Source**: `https://wetten.overheid.nl/`
- **Format**: XML (Juriconnect standard)
- **Identifiers**: BWB-ID (Basiswettenbestand)
- **Content**: Laws, chapters (hoofdstukken), articles (artikelen)
- **Includes**: BW, WvSr, AWB, Grondwet, etc.

## 🚀 Quick Start - Complete Ingestion

## Recommended staged rollout

Use the staged runner to make the rollout explicit and track completion:

```bash
npx tsx scripts/legal-ai/run-ingestion-stage.ts --list
```

Recommended order:

1. `koop-core-civil-labor`
2. `koop-public-criminal-tax`
3. `koop-gap-fill-remaining`
4. `eurlex-aml-package`
5. `official-guidance-supervisors`
6. `rechtspraak-priority-foundation`
7. `rechtspraak-next-50000`

Run a stage:

```bash
npx tsx scripts/legal-ai/run-ingestion-stage.ts --stage koop-core-civil-labor
```

Run an EU AML stage:

```bash
npx tsx scripts/legal-ai/run-ingestion-stage.ts --stage eurlex-aml-package
```

Run an official guidance stage:

```bash
npx tsx scripts/legal-ai/run-ingestion-stage.ts --stage official-guidance-supervisors
```

Mark the large 50k Rechtspraak stage complete after running it yourself:

```bash
npx tsx scripts/legal-ai/run-ingestion-stage.ts --complete rechtspraak-next-50000
```

Stage status is stored in:

```text
scripts/legal-ai/data/ingestion-stage-status.json
```

### Option 1: Run Everything (Recommended)

```bash
# 1. First, apply database migration
npm run db:push

# 2. Run the master orchestrator (ingests everything)
npx tsx scripts/legal-ai/orchestrate-ingestion.ts
```

This will:
1. ✅ Ingest ~30 Dutch laws (Burgerlijk Wetboek, Strafrecht, etc.)
2. ✅ Ingest landmark cases by rechtsgebied
3. ✅ Categorize all documents
4. ✅ Map connections between cases and laws
5. ✅ Generate statistics report

### Option 2: Run Individual Phases

```bash
# Phase 1: Legislation only
npx tsx scripts/legal-ai/batch-ingest-koop.ts

# Phase 2: Case law only
npx tsx scripts/legal-ai/batch-ingest-rechtspraak.ts

# Phase 3: Map connections only
npx tsx scripts/legal-ai/connection-mapper.ts
```

## 📊 What's Being Ingested

### Legislation (KOOP/BWB)

| Rechtsgebied | Laws Included |
|--------------|---------------|
| **CIVIEL_RECHT** | Burgerlijk Wetboek (Boeken 1-7), etc. |
| **STRAFRECHT** | WvSr, WvSv, WMSr |
| **BESTUURSRECHT** | AWB, Omgevingswet, Wabo |
| **ARBEIDSRECHT** | WWZ, WW, WAO, WIA |
| **FISCAAL_RECHT** | AWR, Vpb, IB, BTW, Successiewet |
| **EUROPEES_RECHT** | Grondwet |

**Total**: ~30 major Dutch laws with full hierarchy

### Case Law (Rechtspraak)

| Rechtsgebied | Landmark Cases |
|--------------|----------------|
| **CIVIEL_RECHT** | Hendrikman (aansprakelijkheid), Stolk, Kabelregeling |
| **STRAFRECHT** | Bewijsrecht, Medeplegen, OM afdoening |
| **BESTUURSRECHT** | ABRvS bevoegdheid, CRvB sociale zekerheid |
| **ARBEIDSRECHT** | Ontslag, Concurrentiebeding, Transitievergoeding |
| **FISCAAL_RECHT** | Belastingheffing, Vpb, Hardheidsclausule |
| **EUROPEES_RECHT** | EU-recht primacy, EHRM, GDPR |

## 🗂️ Categorization & Classification

All documents are automatically categorized:

1. **By Source Type**:
   - `JURISPRUDENTIE` - Case law
   - `WETGEVING` - Legislation

2. **By Rechtsgebied**:
   - `CIVIEL_RECHT` - Civil law
   - `STRAFRECHT` - Criminal law
   - `BESTUURSRECHT` - Administrative law
   - `ARBEIDSRECHT` - Labor law
   - `FISCAAL_RECHT` - Tax law
   - `EUROPEES_RECHT` - European law

3. **By Priority** (legislation only):
   - `high` - Core laws (BW, WvSr, AWB)
   - `medium` - Important supporting laws
   - `low` - Specialized laws

## 🔗 Connection Mapping

The system automatically creates connections between:

- **Case → Law**: When a case cites an article (e.g., "artikel 6:162 BW")
- **Case → Case**: When a case references another case (via ECLI)
- **Law → Law**: Cross-references between legislation

Connection types:
- `verwijzing` - Reference to another document
- `toepassing` - Application of a legal provision
- `uitleg` - Interpretation reference

## 📁 Progress Tracking

All scripts support resumable ingestion:

```
scripts/legal-ai/data/
├── koop-progress.json          # Legislation progress
├── rechtspraak-progress.json   # Case law progress
├── connection-progress.json    # Connection mapping progress
├── koop-errors.json            # Failed legislation
├── rechtspraak-errors.json     # Failed cases
└── ingestion-report.json       # Final report
```

If ingestion fails, simply re-run the script - it will skip already completed items.

## 📈 Expected Results

After complete ingestion:

```
Total Legal Nodes:    ~50,000+
  - Legislation:      ~30 laws, ~5,000 articles
  - Case Law:         ~35 landmark cases, ~2,000 considerations
Total Connections:    ~500+ citations
```

## 🎯 What You Can Ask the AI

Once data is ingested, you can ask:

### Civil Law (Civiel Recht)
- *"Wat zegt artikel 6:162 BW over onrechtmatige daad?"*
- *"Leg me de Hendrikman-zaak uit"*
- *"Wat zijn de elementen van onrechtmatige daad?"*

### Criminal Law (Strafrecht)
- *"Wat is het verschil tussen medeplegen en medeplichtigheid?"*
- *"Wat zegt de Hoge Raad over bewijsrecht?"*

### Administrative Law (Bestuursrecht)
- *"Wat is de bevoegdheid van de Awb?"*
- *"Leg de Omgevingswet uit"*

### Labor Law (Arbeidsrecht)
- *"Wat is de transitievergoeding?"*
- *"Wanneer is een concurrentiebeding geldig?"*

### Tax Law (Fiscaal Recht)
- *"Hoe werkt de vennootschapsbelasting?"*
- *"Wat zijn de aftrekbare kosten?"*

## 🔧 Advanced: Custom Ingestion

### Add Specific Cases

Edit `batch-ingest-rechtspraak.ts`:

```typescript
const PRIORITY_CASES: Record<Rechtsgebied, string[]> = {
  'CIVIEL_RECHT': [
    'ECLI:NL:HR:2023:1234',  // Add your ECLI here
    // ...
  ],
  // ...
};
```

### Add Specific Laws

Edit `batch-ingest-koop.ts`:

```typescript
const DUTCH_LAWS: Array<{
  bwbId: string;
  citeertitel: string;
  rechtsgebied: Rechtsgebied;
  description: string;
  priority: 'high' | 'medium' | 'low';
}> = [
  {
    bwbId: 'BWBRxxxxxxx',  // Add BWB ID
    citeertitel: 'Your Law Name',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Description',
    priority: 'medium',
  },
  // ...
];
```

## ⚠️ Important Notes

1. **API Rate Limits**: Scripts include delays (1-2s between calls) to be nice to government servers
2. **Partial Data**: Some ECLIs may not be available in the Open Data API
3. **Time**: Full ingestion takes ~30-60 minutes depending on connection
4. **Resumable**: If interrupted, re-run - it will continue where it left off
5. **Database Size**: Expect ~100MB+ for complete ingestion

## 🆘 Troubleshooting

### "Table does not exist"
```bash
npm run db:push
```

### "Connection refused"
- Check your DATABASE_URL in .env
- Ensure PostgreSQL is running

### "API timeout"
- Normal for slow government servers
- Script will retry automatically (3 attempts)
- Check error logs in `data/*-errors.json`

### "Out of memory"
- Reduce BATCH_SIZE in scripts
- Close other applications
- Consider ingesting in phases

## 📞 Support

After ingestion, access the AI at:
- `http://localhost:3000/app/legal-ai` - Global search
- `http://localhost:3000/app/cases/civil` - Civil law only
- `http://localhost:3000/app/legislation` - Legislation only
