"""Document structure extraction utilities."""

import re
from typing import List, Optional, Dict, Tuple

from src.models.documents import DocumentSection


class StructureExtractor:
    """Extract hierarchical structure from document text."""

    # Common section number patterns
    SECTION_PATTERNS = [
        # Numbered sections: 1., 1.1, 1.1.1
        r'^(\d+(?:\.\d+)*)\s+(.+?)$',
        # Article format: Article 1, Art. 1.2
        r'^(?:Article|Art\.?)\s+(\d+(?:\.\d+)*)[:\s]+(.+?)$',
        # Section format: Section 1, Sec. 1.2
        r'^(?:Section|Sec\.?)\s+(\d+(?:\.\d+)*)[:\s]+(.+?)$',
        # Paragraph format: § 1, Para. 1
        r'^(?:§|Para\.?|Paragraph)\s+(\d+(?:\.\d+)*)[:\s]+(.+?)$',
        # Letter sections: (a), (i), a), a.
        r'^([a-z]|\([a-z]\)|[ivxlcdm]+)\s+(.+?)$',
    ]

    # Heading markers from parsers
    HEADING_PATTERN = r'^\[HEADING(\d+)\]\s+(.+?)$'
    PAGE_PATTERN = r'^\[PAGE\s+(\d+)\]'

    def __init__(self, text: str):
        """Initialize structure extractor.

        Args:
            text: Document text to extract structure from
        """
        self.text = text
        self.lines = text.split('\n')
        self.sections: List[DocumentSection] = []
        self.current_page = 1

    def extract_sections(self) -> List[DocumentSection]:
        """Extract sections from document text.

        Returns:
            List of DocumentSection objects
        """
        current_section: Optional[DocumentSection] = None
        current_content: List[str] = []
        section_stack: List[DocumentSection] = []  # Stack for hierarchy

        for line in self.lines:
            # Check for page markers
            page_match = re.match(self.PAGE_PATTERN, line)
            if page_match:
                self.current_page = int(page_match.group(1))
                continue

            # Check for heading markers (from DOCX parser)
            heading_match = re.match(self.HEADING_PATTERN, line, re.IGNORECASE)
            if heading_match:
                # Save previous section
                if current_section:
                    current_section.content = '\n'.join(current_content).strip()
                    self.sections.append(current_section)
                    current_content = []

                level = int(heading_match.group(1))
                title = heading_match.group(2).strip()

                # Create new section
                section_id = self._generate_section_id(level, title)
                parent_id = self._find_parent_id(level, section_stack)

                current_section = DocumentSection(
                    section_id=section_id,
                    title=title,
                    content="",
                    page=self.current_page,
                    parent=parent_id,
                    metadata={"level": level, "type": "heading"}
                )

                # Update section stack
                self._update_section_stack(section_stack, current_section, level)
                continue

            # Check for numbered sections
            section_match = self._match_section_pattern(line)
            if section_match:
                # Save previous section
                if current_section:
                    current_section.content = '\n'.join(current_content).strip()
                    self.sections.append(current_section)
                    current_content = []

                section_id, title = section_match

                # Determine parent
                parent_id = self._find_parent_by_id(section_id)

                current_section = DocumentSection(
                    section_id=section_id,
                    title=title,
                    content="",
                    page=self.current_page,
                    parent=parent_id,
                    metadata={"type": "numbered"}
                )
                continue

            # Add line to current section content
            if current_section:
                current_content.append(line)

        # Save last section
        if current_section:
            current_section.content = '\n'.join(current_content).strip()
            self.sections.append(current_section)

        # Update subsections
        self._populate_subsections()

        return self.sections

    def _match_section_pattern(self, line: str) -> Optional[Tuple[str, str]]:
        """Match line against section patterns.

        Args:
            line: Line to match

        Returns:
            Tuple of (section_id, title) or None
        """
        line = line.strip()

        for pattern in self.SECTION_PATTERNS:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                section_id = match.group(1)
                title = match.group(2).strip()

                # Filter out very long "titles" (likely not a section header)
                if len(title) < 200:
                    return (section_id, title)

        return None

    def _generate_section_id(self, level: int, title: str) -> str:
        """Generate section ID from heading level and title.

        Args:
            level: Heading level
            title: Section title

        Returns:
            Section ID
        """
        # Count sections at this level
        count = sum(1 for s in self.sections if s.metadata.get("level") == level)

        return f"H{level}.{count + 1}"

    def _find_parent_id(self, level: int, section_stack: List[DocumentSection]) -> Optional[str]:
        """Find parent section ID from stack.

        Args:
            level: Current heading level
            section_stack: Stack of sections

        Returns:
            Parent section ID or None
        """
        # Find the most recent section with level < current level
        for section in reversed(section_stack):
            if section.metadata.get("level", 999) < level:
                return section.section_id

        return None

    def _find_parent_by_id(self, section_id: str) -> Optional[str]:
        """Find parent section ID based on section numbering.

        Args:
            section_id: Current section ID (e.g., "3.2.1")

        Returns:
            Parent section ID or None
        """
        # For numbered sections like "3.2.1", parent is "3.2"
        parts = section_id.split('.')

        if len(parts) > 1:
            parent_id = '.'.join(parts[:-1])
            # Check if parent exists
            if any(s.section_id == parent_id for s in self.sections):
                return parent_id

        return None

    def _update_section_stack(self, stack: List[DocumentSection], section: DocumentSection, level: int):
        """Update section stack for hierarchy tracking.

        Args:
            stack: Section stack
            section: Current section
            level: Section level
        """
        # Remove sections at same or lower level
        while stack and stack[-1].metadata.get("level", 0) >= level:
            stack.pop()

        # Add current section
        stack.append(section)

    def _populate_subsections(self):
        """Populate subsections field for all sections."""
        # Build a map of parent to children
        children_map: Dict[str, List[str]] = {}

        for section in self.sections:
            if section.parent:
                if section.parent not in children_map:
                    children_map[section.parent] = []
                children_map[section.parent].append(section.section_id)

        # Update subsections
        for section in self.sections:
            section.subsections = children_map.get(section.section_id, [])

    def get_section_hierarchy(self) -> Dict[str, any]:
        """Get hierarchical representation of sections.

        Returns:
            Nested dictionary of sections
        """
        # Build hierarchy
        root_sections = [s for s in self.sections if not s.parent]
        hierarchy = []

        for root in root_sections:
            hierarchy.append(self._build_hierarchy_node(root))

        return {"sections": hierarchy}

    def _build_hierarchy_node(self, section: DocumentSection) -> Dict[str, any]:
        """Build hierarchy node for a section.

        Args:
            section: Section to build node for

        Returns:
            Dictionary representing the node
        """
        node = {
            "section_id": section.section_id,
            "title": section.title,
            "page": section.page,
            "has_content": bool(section.content),
            "children": []
        }

        # Add children
        for subsection_id in section.subsections:
            subsection = next((s for s in self.sections if s.section_id == subsection_id), None)
            if subsection:
                node["children"].append(self._build_hierarchy_node(subsection))

        return node


def extract_structure(text: str) -> List[DocumentSection]:
    """Extract document structure from text.

    Args:
        text: Document text

    Returns:
        List of DocumentSection objects
    """
    extractor = StructureExtractor(text)
    return extractor.extract_sections()
