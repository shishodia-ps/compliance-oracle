# Compliance Oracle - Quick Start Guide

This guide will help you get the Compliance Oracle application up and running.

## Prerequisites

- Python 3.10 or higher
- API keys for:
  - OpenAI (for GPT models) OR
  - Anthropic (for Claude models)

## Installation

### 1. Install Dependencies

Install all required Python packages:

```bash
pip install -r requirements.txt
```

**Note:** If you encounter issues installing `langdetect`, it's optional and the app will work without it (defaulting to English language detection).

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file and add your API keys:

```env
# Required: Choose at least one LLM provider
OPENAI_API_KEY=your_openai_api_key_here
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Azure OpenAI (optional, if using Azure)
AZURE_OPENAI_API_KEY=your_azure_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_API_VERSION=2024-02-01

# Application Settings
LOG_LEVEL=INFO
CHROMA_PERSIST_DIRECTORY=./data/chroma_db
```

### 3. Verify Installation

Run the import tests to ensure everything is set up correctly:

```bash
python tests/test_imports.py
```

You should see:
```
✓ All imports successful!
Total modules tested: 21
Passed: 21
Failed: 0
```

Run the integration tests:

```bash
python tests/integration/test_basic_flow.py
```

You should see:
```
✓ All integration tests passed!
Tests passed: 8
Tests failed: 0
```

## Running the Application

### Start the Streamlit UI

```bash
streamlit run ui/app.py
```

The application will open in your default browser at `http://localhost:8501`

### Using the Application

1. **Configure Settings** (Left Sidebar):
   - Select your jurisdiction (e.g., Luxembourg, UK, EU)
   - Choose compliance domains (AML, GDPR, etc.)
   - Select LLM provider and model
   - Configure document language

2. **Upload Documents**:
   - Upload your internal policy document (PDF, DOCX, etc.)
   - Either:
     - Auto-fetch regulatory benchmarks based on jurisdiction, OR
     - Upload a benchmark document, OR
     - Provide a URL to the regulation

3. **Run Analysis**:
   - Click "Start Analysis"
   - The workflow will:
     - Parse both documents
     - Extract requirements from the benchmark
     - Analyze your policy for compliance gaps
     - Generate findings with recommendations

4. **View Results**:
   - Compliance dashboard shows overall statistics
   - Findings viewer shows detailed gap analysis
   - Export reports in PDF, DOCX, Excel, or JSON format

## Application Architecture

### Core Components

- **Services** (`src/services/`):
  - `llm.py` - LLM client for OpenAI and Anthropic
  - `embedding.py` - Text embedding generation
  - `vector_store.py` - ChromaDB vector storage

- **Agents** (`src/agents/`):
  - `requirement_extractor.py` - Extracts requirements from regulations
  - `query_agent.py` - Generates search queries
  - `retrieval_agent.py` - Retrieves relevant policy sections
  - `analysis_agent.py` - Analyzes compliance gaps
  - `validation_agent.py` - Validates findings

- **Workflow** (`src/workflow/`):
  - `graph.py` - LangGraph workflow orchestration
  - `state.py` - Workflow state management
  - `nodes.py` - Workflow node functions

- **UI** (`ui/`):
  - `app.py` - Main Streamlit application
  - `components/` - Reusable UI components

- **Models** (`src/models/`):
  - `documents.py` - Document and section models
  - `requirements.py` - Requirement models
  - `findings.py` - Finding and compliance models

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `INFO` |
| `CHROMA_PERSIST_DIRECTORY` | ChromaDB storage path | `./data/chroma_db` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | - |
| `AZURE_OPENAI_ENDPOINT` | Azure endpoint URL | - |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name | - |
| `AZURE_API_VERSION` | Azure API version | `2024-02-01` |

## Troubleshooting

### Import Errors

If you see import errors, ensure all dependencies are installed:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Missing API Keys

If the app shows "API key not configured":

1. Check your `.env` file exists in the project root
2. Verify the API key is correctly formatted
3. Restart the Streamlit app to reload environment variables

### ChromaDB Errors

If you encounter ChromaDB initialization errors:

```bash
# Clear the ChromaDB directory
rm -rf ./data/chroma_db
# Restart the application
```

### LangGraph Import Issues

If you see errors related to LangGraph:

```bash
pip install --upgrade langgraph langchain langchain-openai langchain-anthropic
```

## Next Steps

- **Documentation**: See `docs/` folder for detailed architecture docs
- **Configuration**: Customize `src/config/settings.py` for your needs
- **Benchmarks**: Add custom benchmarks to `src/config/benchmarks.py`
- **Keywords**: Extend multilingual keywords in `src/config/keywords.py`

## Support

For issues or questions:
- Check the main `README.md` for architecture details
- Review code comments in `src/` modules
- Check test files in `tests/` for usage examples

---

**Note**: The application uses LLM APIs which may incur costs. Monitor your API usage and set appropriate rate limits.
