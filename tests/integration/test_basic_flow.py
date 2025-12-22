"""
Integration test for basic application flow.
Tests core functionality without requiring API keys.
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models.documents import Document, DocumentSection
from src.models.requirements import Requirement
from src.models.findings import Finding, ComplianceStatus, Severity, PolicySection
from src.workflow.state import create_initial_state


def test_create_document():
    """Test creating a document model."""
    doc = Document(
        document_id="test-doc-1",
        filename="test_policy.pdf",
        file_type="pdf",
        raw_text="This is a test policy document about anti-money laundering."
    )

    assert doc.document_id == "test-doc-1"
    assert doc.filename == "test_policy.pdf"
    assert "anti-money laundering" in doc.raw_text
    assert doc.language == "en"  # default value
    print("✓ Document creation successful")


def test_create_document_section():
    """Test creating a document section."""
    section = DocumentSection(
        section_id="2.3",
        title="Beneficial Ownership",
        content="This section defines beneficial ownership requirements..."
    )

    assert section.section_id == "2.3"
    assert section.title == "Beneficial Ownership"
    assert "beneficial ownership" in section.content.lower()
    print("✓ Document section creation successful")


def test_create_requirement():
    """Test creating a requirement model."""
    req = Requirement(
        requirement_id="REQ-001",
        source="EU AMLD6",
        citation="Article 3(6)(a)",
        text="Obliged entities must identify the beneficial owner.",
        requirement_type="mandatory",
        category="CDD",
        criticality="high"
    )

    assert req.requirement_id == "REQ-001"
    assert req.citation == "Article 3(6)(a)"
    assert req.criticality == "high"
    assert req.source == "EU AMLD6"
    assert req.requirement_type == "mandatory"
    print("✓ Requirement creation successful")


def test_create_finding():
    """Test creating a compliance finding."""
    finding = Finding(
        finding_id="FIND-001",
        requirement_id="REQ-001",
        requirement_citation="Article 3(6)(a)",
        requirement_text="Test requirement",
        status="gap",
        confidence=0.85,
        severity="high",
        recommendation="Add beneficial owner definition to Section 2.3"
    )

    assert finding.finding_id == "FIND-001"
    assert finding.status == "gap"
    assert finding.confidence == 0.85
    assert finding.severity == "high"
    print("✓ Finding creation successful")


def test_workflow_state_creation():
    """Test creating workflow state."""
    state = create_initial_state()

    assert state["policy_document"] is None
    assert state["benchmark_document"] is None
    assert state["requirements"] == []
    assert state["findings"] == []
    print("✓ Workflow state creation successful")


def test_policy_section():
    """Test PolicySection model."""
    section = PolicySection(
        section_id="2.3.1",
        title="Identification Requirements",
        content="Entities must collect and verify identification information...",
        relevance_score=0.92
    )

    assert section.section_id == "2.3.1"
    assert section.relevance_score == 0.92
    assert section.page_number is None  # optional field
    print("✓ Policy section creation successful")


def test_compliance_status_enum():
    """Test ComplianceStatus enum."""
    assert ComplianceStatus.COMPLIANT.value == "compliant"
    assert ComplianceStatus.GAP.value == "gap"
    assert ComplianceStatus.PARTIAL_GAP.value == "partial_gap"
    assert ComplianceStatus.UNCERTAIN.value == "uncertain"
    assert ComplianceStatus.CONTRADICTION.value == "contradiction"
    print("✓ ComplianceStatus enum working correctly")


def test_severity_enum():
    """Test Severity enum."""
    assert Severity.CRITICAL.value == "critical"
    assert Severity.HIGH.value == "high"
    assert Severity.MEDIUM.value == "medium"
    assert Severity.LOW.value == "low"
    print("✓ Severity enum working correctly")


def main():
    """Run all integration tests."""
    print("\nRunning Integration Tests")
    print("=" * 60)

    tests = [
        test_create_document,
        test_create_document_section,
        test_create_requirement,
        test_create_finding,
        test_workflow_state_creation,
        test_policy_section,
        test_compliance_status_enum,
        test_severity_enum,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"✗ {test.__name__} failed: {str(e)}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 60)
    print(f"Tests passed: {passed}")
    print(f"Tests failed: {failed}")

    if failed == 0:
        print("\n✓ All integration tests passed!")
        return 0
    else:
        print(f"\n✗ {failed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
