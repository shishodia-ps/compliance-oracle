"""
Test that all modules can be imported successfully.
This catches missing dependencies and import errors early.
"""
import sys
import traceback
from pathlib import Path

# Add root to path so we can import src.* and ui.*
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

def test_import(module_path: str) -> tuple[bool, str]:
    """Test importing a module."""
    try:
        # Convert module path to src.* format if it doesn't start with ui
        if not module_path.startswith('ui.'):
            module_path = f"src.{module_path}"
        __import__(module_path)
        return True, f"✓ {module_path}"
    except Exception as e:
        tb = traceback.format_exc()
        return False, f"✗ {module_path}\n  Error: {str(e)}\n{tb}"

def main():
    """Test all module imports."""
    print("Testing module imports...\n")

    modules_to_test = [
        # Core services
        "services.llm",
        "services.embedding",
        "services.vector_store",

        # Agents
        "agents.base",
        "agents.requirement_extractor",
        "agents.query_agent",
        "agents.retrieval_agent",
        "agents.analysis_agent",
        "agents.validation_agent",

        # Workflow
        "workflow.graph",
        "workflow.state",
        "workflow.nodes",

        # UI
        "ui.styles",
        "ui.components.sidebar",
        "ui.components.upload",
        "ui.components.findings",
        "ui.components.progress",
        "ui.components.export",

        # Utils (skip for now - may not have standalone modules)
        # "utils.config",
        # "utils.logger",
        # "utils.embeddings",
        # "utils.prompts",

        # Models
        "models.documents",
        "models.requirements",
        "models.findings",
    ]

    results = []
    failed = []

    for module in modules_to_test:
        success, message = test_import(module)
        results.append(message)
        if not success:
            failed.append(module)

    # Print results
    print("\n".join(results))

    # Summary
    print("\n" + "=" * 60)
    print(f"Total modules tested: {len(modules_to_test)}")
    print(f"Passed: {len(modules_to_test) - len(failed)}")
    print(f"Failed: {len(failed)}")

    if failed:
        print("\nFailed modules:")
        for module in failed:
            print(f"  - {module}")
        sys.exit(1)
    else:
        print("\n✓ All imports successful!")
        sys.exit(0)

if __name__ == "__main__":
    main()
