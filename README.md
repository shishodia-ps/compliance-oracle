# Compliance Oracle v3.0

**Agentic AI-powered regulatory compliance gap analysis system**

## Overview

Compliance Oracle analyzes company policy documents against regulatory benchmarks to identify compliance gaps. It uses an Agentic RAG architecture with self-correcting, iterative analysis.

## Features

- **Multi-format support**: PDF, DOCX, TXT, HTML
- **Multilingual**: English, German, French, Dutch, Luxembourgish
- **Multi-domain**: AML, KYC, Sanctions, GDPR, and more
- **Multi-jurisdiction**: EU, Luxembourg, Netherlands, Germany, France, UK, US
- **Agentic RAG**: Iterative retrieval with self-validation
- **Professional reports**: PDF, DOCX, JSON, Excel export

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/compliance-oracle.git
cd compliance-oracle

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the application
streamlit run app.py
```

## Project Structure

```
compliance-oracle/
├── app.py                    # Streamlit entry point
├── src/
│   ├── config/              # Configuration (settings, keywords, models)
│   ├── models/              # Pydantic data models
│   ├── parsers/             # Document parsers (PDF, DOCX, etc.)
│   ├── services/            # Core services (LLM, embeddings, vector store)
│   ├── agents/              # Agentic components
│   ├── workflow/            # LangGraph workflow
│   ├── reporting/           # Report generation
│   └── utils/               # Utility functions
├── ui/
│   ├── components/          # Reusable UI components
│   └── pages/               # Streamlit pages
└── tests/                   # Test suite
```

## Architecture

```
Document Upload → Parsing → Requirement Extraction
                                    ↓
                    ┌───────────────────────────────┐
                    │     AGENTIC ANALYSIS LOOP     │
                    │                               │
                    │  Query Agent → Retrieval Agent│
                    │       ↓              ↓        │
                    │  Analysis Agent ← Validation  │
                    │       ↓                       │
                    │   Valid Finding               │
                    └───────────────────────────────┘
                                    ↓
                            Report Generation
```

## Documentation

- [Complete Specification](docs/SPECIFICATION.md)
- [Claude Code Instructions](CLAUDE_INSTRUCTIONS.md)

## License

MIT License
