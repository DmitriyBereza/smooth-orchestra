/**
 * SubtaskParser — parses the Architect's dev-tasks.md into structured subtask objects.
 *
 * The expected markdown format:
 *
 * ```markdown
 * ## Dev Task 1: Title here
 * **Files**: file1.ts, file2.ts
 * **Dependencies**: Dev Task 2, Dev Task 3
 * **Description**: Full description text...
 * ```
 */

/** A single parsed dev task extracted from the Architect's dev-tasks.md. */
export interface ParsedSubtask {
  /** 1-based index from the heading (e.g. "Dev Task 3" → 3). */
  index: number;
  /** The task title after the colon in the heading. */
  title: string;
  /** File paths listed in the Files field. */
  files: string[];
  /** Full description text. */
  description: string;
  /** Indices of tasks this one depends on. */
  dependencies: number[];
}

/**
 * Parse a dev-tasks.md markdown string into an array of {@link ParsedSubtask} objects.
 *
 * Tolerant of formatting variations: missing bold markers, extra whitespace,
 * missing fields. Returns an empty array for empty or invalid input.
 */
export function parseDevTasks(markdown: string): ParsedSubtask[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  // Split into sections starting with "## Dev Task N"
  const taskPattern = /^##\s+Dev\s+Task\s+(\d+)\s*:\s*(.+)$/gim;
  const matches: { taskIndex: number; title: string; start: number; headingPos: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskPattern.exec(markdown)) !== null) {
    matches.push({
      taskIndex: parseInt(match[1], 10),
      title: match[2].trim(),
      start: match.index + match[0].length,
      headingPos: match.index,
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const results: ParsedSubtask[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { taskIndex, title, start } = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1].headingPos : markdown.length;
    const body = markdown.slice(start, end);

    results.push({
      index: taskIndex,
      title,
      files: parseFiles(body),
      description: parseDescription(body),
      dependencies: parseDependencies(body),
    });
  }

  return results;
}

/** Extract files from a "**Files**: ..." or "Files: ..." line. */
function parseFiles(body: string): string[] {
  const match = body.match(/^\*{0,2}Files\*{0,2}\s*:\s*(.+)$/im);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Extract the description from a "**Description**: ..." or "Description: ..." line. */
function parseDescription(body: string): string {
  const match = body.match(/^\*{0,2}Description\*{0,2}\s*:\s*(.+)$/im);
  if (!match) return '';
  return match[1].trim();
}

/** Extract dependency indices from a "**Dependencies**: ..." line. */
function parseDependencies(body: string): number[] {
  const match = body.match(/^\*{0,2}Dependencies\*{0,2}\s*:\s*(.+)$/im);
  if (!match) return [];

  const raw = match[1].trim().toLowerCase();
  if (raw === 'none' || raw === '') return [];

  // Support both "Dev Task 1, Dev Task 3" and bare "1, 3" formats
  const parts = match[1].split(',').map((s) => s.trim());
  const indices: number[] = [];

  for (const part of parts) {
    // Try "Dev Task N" format first
    const devTaskMatch = part.match(/Dev\s+Task\s+(\d+)/i);
    if (devTaskMatch) {
      indices.push(parseInt(devTaskMatch[1], 10));
      continue;
    }
    // Try bare number
    const num = parseInt(part, 10);
    if (!isNaN(num)) {
      indices.push(num);
    }
  }

  return indices;
}
