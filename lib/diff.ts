/**
 * Diff utility for comparing document content
 * Implements a simple LCS-based diff algorithm (no external dependencies)
 */

export type DiffType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
  type: DiffType;
  text: string;
  lineNum: { old?: number; new?: number };
}

export interface DiffBlock {
  type: DiffType;
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  lines: DiffLine[];
}

export interface SectionDiff {
  path: string;
  title: string;
  level: number;
  originalText: string;
  revisedText: string;
  diff: DiffLine[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

export interface DocumentDiff {
  blocks: DiffBlock[];
  stats: {
    totalAdditions: number;
    totalDeletions: number;
    totalUnchanged: number;
    sectionsChanged: number;
  };
  sections: SectionDiff[];
}

/**
 * Compute Longest Common Subsequence (LCS)
 * Returns the sequence of indices for the common elements
 */
function lcs<T>(a: T[], b: T[]): { aIdx: number; bIdx: number }[] {
  const m = a.length;
  const n = b.length;
  
  // Use dynamic programming with space optimization
  // We only need two rows
  const dp: number[][] = [[], []];
  
  for (let i = 0; i <= m; i++) {
    dp[0][i] = 0;
  }
  
  for (let j = 1; j <= n; j++) {
    dp[j % 2][0] = 0;
    for (let i = 1; i <= m; i++) {
      if (a[i - 1] === b[j - 1]) {
        dp[j % 2][i] = (dp[(j - 1) % 2][i - 1] || 0) + 1;
      } else {
        dp[j % 2][i] = Math.max(dp[(j - 1) % 2][i] || 0, dp[j % 2][i - 1] || 0);
      }
    }
  }
  
  // Backtrack to find the sequence
  const result: { aIdx: number; bIdx: number }[] = [];
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ aIdx: i - 1, bIdx: j - 1 });
      i--;
      j--;
    } else if ((dp[j % 2][i - 1] || 0) > (dp[(j - 1) % 2][i] || 0)) {
      i--;
    } else {
      j--;
    }
  }
  
  return result;
}

/**
 * Compute line-by-line diff between two texts
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const common = lcs(oldLines, newLines);
  const result: DiffLine[] = [];
  
  let oldIdx = 0;
  let newIdx = 0;
  
  for (const match of common) {
    // Add removed lines (from old only)
    while (oldIdx < match.aIdx) {
      result.push({
        type: 'removed',
        text: oldLines[oldIdx],
        lineNum: { old: oldIdx + 1 },
      });
      oldIdx++;
    }
    
    // Add added lines (from new only)
    while (newIdx < match.bIdx) {
      result.push({
        type: 'added',
        text: newLines[newIdx],
        lineNum: { new: newIdx + 1 },
      });
      newIdx++;
    }
    
    // Add common line
    result.push({
      type: 'unchanged',
      text: oldLines[oldIdx],
      lineNum: { old: oldIdx + 1, new: newIdx + 1 },
    });
    oldIdx++;
    newIdx++;
  }
  
  // Add remaining removed lines
  while (oldIdx < oldLines.length) {
    result.push({
      type: 'removed',
      text: oldLines[oldIdx],
      lineNum: { old: oldIdx + 1 },
    });
    oldIdx++;
  }
  
  // Add remaining added lines
  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      text: newLines[newIdx],
      lineNum: { new: newIdx + 1 },
    });
    newIdx++;
  }
  
  return result;
}

/**
 * Group diff lines into blocks for better visualization
 */
function groupIntoBlocks(lines: DiffLine[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let currentBlock: DiffBlock | null = null;
  
  let oldLineNum = 1;
  let newLineNum = 1;
  
  for (const line of lines) {
    // Start a new block if type changes
    if (!currentBlock || currentBlock.type !== line.type) {
      if (currentBlock) {
        currentBlock.oldEnd = oldLineNum - 1;
        currentBlock.newEnd = newLineNum - 1;
      }
      currentBlock = {
        type: line.type,
        oldStart: line.lineNum.old || oldLineNum,
        oldEnd: line.lineNum.old || oldLineNum,
        newStart: line.lineNum.new || newLineNum,
        newEnd: line.lineNum.new || newLineNum,
        lines: [],
      };
      blocks.push(currentBlock);
    }
    
    currentBlock.lines.push(line);
    
    if (line.lineNum.old) oldLineNum = line.lineNum.old + 1;
    if (line.lineNum.new) newLineNum = line.lineNum.new + 1;
  }
  
  if (currentBlock) {
    currentBlock.oldEnd = oldLineNum - 1;
    currentBlock.newEnd = newLineNum - 1;
  }
  
  return blocks;
}

/**
 * Extract sections from any document type
 * Handles: Markdown headings, plain text lines, Word docs, mixed content
 */
export function extractSections(text: string): Array<{
  title: string;
  level: number;
  content: string;
  path: string;
}> {
  const sections: Array<{ title: string; level: number; content: string; path: string }> = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // First pass: look for markdown headings (# ## ###)
  const hasHeadings = lines.some(line => /^#{1,6}\s+/.test(line));
  
  if (hasHeadings) {
    // Extract using markdown headings
    return extractMarkdownSections(text);
  }
  
  // Second pass: look for numbered sections (1. 1.1 1.1.1)
  const hasNumberedSections = lines.some(line => /^\d+(\.\d+)*\s+/.test(line));
  
  if (hasNumberedSections) {
    return extractNumberedSections(lines);
  }
  
  // Fallback: treat each non-empty line as a section
  // This handles plain text lists, simple Word docs, etc.
  return extractLineSections(lines);
}

/**
 * Extract sections from markdown headings
 */
function extractMarkdownSections(markdown: string): Array<{
  title: string;
  level: number;
  content: string;
  path: string;
}> {
  const sections: Array<{ title: string; level: number; content: string; path: string }> = [];
  const lines = markdown.split('\n');
  
  let currentSection: { title: string; level: number; content: string[]; path: string[] } | null = null;
  const sectionStack: typeof currentSection[] = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          level: currentSection.level,
          content: currentSection.content.join('\n'),
          path: currentSection.path.join(' > '),
        });
      }
      
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      
      // Pop sections with equal or higher level
      while (sectionStack.length > 0 && (sectionStack[sectionStack.length - 1]?.level || 0) >= level) {
        sectionStack.pop();
      }
      
      const path = [...sectionStack.map(s => s?.title || ''), title];
      
      currentSection = {
        title,
        level,
        content: [],
        path,
      };
      
      sectionStack.push(currentSection);
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }
  
  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      level: currentSection.level,
      content: currentSection.content.join('\n'),
      path: currentSection.path.join(' > '),
    });
  }
  
  return sections;
}

/**
 * Extract sections from numbered headings (1. 1.1 1.1.1)
 */
function extractNumberedSections(lines: string[]): Array<{
  title: string;
  level: number;
  content: string;
  path: string;
}> {
  const sections: Array<{ title: string; level: number; content: string; path: string }> = [];
  
  let currentSection: { title: string; level: number; content: string[] } | null = null;
  
  for (const line of lines) {
    const match = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    
    if (match) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          level: currentSection.level,
          content: currentSection.content.join('\n'),
          path: currentSection.title,
        });
      }
      
      const number = match[1];
      const title = match[2].trim();
      const level = number.split('.').length;
      
      currentSection = {
        title: `${number} ${title}`,
        level,
        content: [],
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }
  
  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      level: currentSection.level,
      content: currentSection.content.join('\n'),
      path: currentSection.title,
    });
  }
  
  return sections;
}

/**
 * Extract sections from plain text lines
 * Each non-empty line becomes a section
 */
function extractLineSections(lines: string[]): Array<{
  title: string;
  level: number;
  content: string;
  path: string;
}> {
  // Group consecutive lines with similar indentation
  const sections: Array<{ title: string; level: number; content: string; path: string }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip very short lines (likely fragments)
    if (line.length < 3) continue;
    
    // Look ahead to gather content
    const contentLines: string[] = [];
    let j = i + 1;
    
    while (j < lines.length && lines[j].length > 0 && !isNewSection(lines[j])) {
      contentLines.push(lines[j]);
      j++;
    }
    
    sections.push({
      title: line.substring(0, 50), // First 50 chars as title
      level: 1,
      content: contentLines.join('\n'),
      path: line,
    });
    
    i = j - 1;
  }
  
  // If no sections found, create one big section
  if (sections.length === 0 && lines.length > 0) {
    sections.push({
      title: 'Document',
      level: 1,
      content: lines.join('\n'),
      path: 'Document',
    });
  }
  
  return sections;
}

/**
 * Check if a line starts a new section
 */
function isNewSection(line: string): boolean {
  // Markdown heading
  if (/^#{1,6}\s+/.test(line)) return true;
  // Numbered section
  if (/^\d+(\.\d+)*\s+/.test(line)) return true;
  // ALL CAPS (likely a heading)
  if (line.length > 3 && line === line.toUpperCase()) return true;
  return false;
}

/**
 * Compute diff between two documents with section alignment
 */
export function computeDocumentDiff(
  originalMarkdown: string,
  revisedMarkdown: string,
  alignByHeadings: boolean = true
): DocumentDiff {
  const sections: SectionDiff[] = [];
  
  if (alignByHeadings) {
    const originalSections = extractSections(originalMarkdown);
    const revisedSections = extractSections(revisedMarkdown);
    
    // Create a map of sections by path for alignment
    const originalMap = new Map(originalSections.map(s => [s.path, s]));
    const revisedMap = new Map(revisedSections.map(s => [s.path, s]));
    
    // Find all unique paths
    const allPaths = new Set<string>();
    originalMap.forEach((_, key) => allPaths.add(key));
    revisedMap.forEach((_, key) => allPaths.add(key));
    
    allPaths.forEach((path) => {
      const orig = originalMap.get(path);
      const rev = revisedMap.get(path);
      
      const originalText = orig?.content || '';
      const revisedText = rev?.content || '';
      
      const diff = computeLineDiff(originalText, revisedText);
      
      const stats = {
        additions: diff.filter(l => l.type === 'added').length,
        deletions: diff.filter(l => l.type === 'removed').length,
        unchanged: diff.filter(l => l.type === 'unchanged').length,
      };
      
      // Only include if there are changes or both exist
      if (stats.additions > 0 || stats.deletions > 0 || (orig && rev)) {
        sections.push({
          path,
          title: orig?.title || rev?.title || path.split(' > ').pop() || '',
          level: orig?.level || rev?.level || 1,
          originalText,
          revisedText,
          diff,
          stats,
        });
      }
    });
  }
  
  // Compute full text diff
  const fullDiff = computeLineDiff(originalMarkdown, revisedMarkdown);
  const blocks = groupIntoBlocks(fullDiff);
  
  const stats = {
    totalAdditions: fullDiff.filter(l => l.type === 'added').length,
    totalDeletions: fullDiff.filter(l => l.type === 'removed').length,
    totalUnchanged: fullDiff.filter(l => l.type === 'unchanged').length,
    sectionsChanged: sections.filter(s => s.stats.additions > 0 || s.stats.deletions > 0).length,
  };
  
  return {
    blocks,
    stats,
    sections: sections.sort((a, b) => a.level - b.level),
  };
}

/**
 * Generate a summary of key changes
 */
export function generateChangeSummary(diff: DocumentDiff): string[] {
  const summary: string[] = [];
  
  // Overall stats
  if (diff.stats.totalAdditions === 0 && diff.stats.totalDeletions === 0) {
    summary.push('No changes detected between the documents.');
    return summary;
  }
  
  summary.push(`${diff.stats.sectionsChanged} sections have changes`);
  
  // Find sections with significant changes
  const changedSections = diff.sections
    .filter(s => s.stats.additions > 0 || s.stats.deletions > 0)
    .sort((a, b) => (b.stats.additions + b.stats.deletions) - (a.stats.additions + a.stats.deletions))
    .slice(0, 10);
  
  for (const section of changedSections) {
    const changes: string[] = [];
    if (section.stats.additions > 0) changes.push(`${section.stats.additions} lines added`);
    if (section.stats.deletions > 0) changes.push(`${section.stats.deletions} lines removed`);
    
    summary.push(`${section.title}: ${changes.join(', ')}`);
  }
  
  // Detect new sections
  const newSections = diff.sections.filter(s => !s.originalText && s.revisedText);
  if (newSections.length > 0) {
    summary.push(`${newSections.length} new section(s) added`);
  }
  
  // Detect removed sections
  const removedSections = diff.sections.filter(s => s.originalText && !s.revisedText);
  if (removedSections.length > 0) {
    summary.push(`${removedSections.length} section(s) removed`);
  }
  
  return summary.slice(0, 15); // Limit to 15 items
}

/**
 * Simple word-level diff for inline highlighting
 */
export function computeWordDiff(oldText: string, newText: string): Array<{ type: DiffType; text: string }> {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  const common = lcs(oldWords, newWords);
  const result: Array<{ type: DiffType; text: string }> = [];
  
  let oldIdx = 0;
  let newIdx = 0;
  
  for (const match of common) {
    while (oldIdx < match.aIdx) {
      result.push({ type: 'removed', text: oldWords[oldIdx] });
      oldIdx++;
    }
    
    while (newIdx < match.bIdx) {
      result.push({ type: 'added', text: newWords[newIdx] });
      newIdx++;
    }
    
    result.push({ type: 'unchanged', text: oldWords[oldIdx] });
    oldIdx++;
    newIdx++;
  }
  
  while (oldIdx < oldWords.length) {
    result.push({ type: 'removed', text: oldWords[oldIdx] });
    oldIdx++;
  }
  
  while (newIdx < newWords.length) {
    result.push({ type: 'added', text: newWords[newIdx] });
    newIdx++;
  }
  
  return result;
}
