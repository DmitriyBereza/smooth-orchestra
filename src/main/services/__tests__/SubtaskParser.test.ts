/**
 * SubtaskParser unit tests
 */
import { describe, it, expect } from 'vitest';
import { parseDevTasks, ParsedSubtask } from '../SubtaskParser';

const WELL_FORMATTED = `
## Dev Task 1: Implement user authentication
**Files**: src/auth/login.ts, src/auth/session.ts
**Dependencies**: none
**Description**: Implement the login form and session management.

## Dev Task 2: Add API endpoints
**Files**: src/api/routes.ts, src/api/middleware.ts
**Dependencies**: Dev Task 1
**Description**: Create REST endpoints for the application.

## Dev Task 3: Write integration tests
**Files**: src/test/integration.test.ts
**Dependencies**: Dev Task 1, Dev Task 2
**Description**: Cover all API endpoints with integration tests.
`;

describe('SubtaskParser', () => {
  describe('standard well-formatted input', () => {
    it('parses multiple dev tasks correctly', () => {
      const tasks = parseDevTasks(WELL_FORMATTED);
      expect(tasks).toHaveLength(3);

      expect(tasks[0]).toEqual<ParsedSubtask>({
        index: 1,
        title: 'Implement user authentication',
        files: ['src/auth/login.ts', 'src/auth/session.ts'],
        description: 'Implement the login form and session management.',
        dependencies: [],
      });

      expect(tasks[1]).toEqual<ParsedSubtask>({
        index: 2,
        title: 'Add API endpoints',
        files: ['src/api/routes.ts', 'src/api/middleware.ts'],
        description: 'Create REST endpoints for the application.',
        dependencies: [1],
      });

      expect(tasks[2]).toEqual<ParsedSubtask>({
        index: 3,
        title: 'Write integration tests',
        files: ['src/test/integration.test.ts'],
        description: 'Cover all API endpoints with integration tests.',
        dependencies: [1, 2],
      });
    });
  });

  describe('single dev task', () => {
    it('parses a single task', () => {
      const md = `## Dev Task 1: Solo task\n**Files**: solo.ts\n**Dependencies**: none\n**Description**: Only one task.`;
      const tasks = parseDevTasks(md);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Solo task');
      expect(tasks[0].files).toEqual(['solo.ts']);
    });
  });

  describe('empty and invalid input', () => {
    it('returns empty array for empty string', () => {
      expect(parseDevTasks('')).toEqual([]);
    });

    it('returns empty array for null/undefined', () => {
      expect(parseDevTasks(null as unknown as string)).toEqual([]);
      expect(parseDevTasks(undefined as unknown as string)).toEqual([]);
    });

    it('returns empty array when no dev tasks found', () => {
      expect(parseDevTasks('# Just a regular heading\nSome text.')).toEqual([]);
    });

    it('returns empty array for markdown with no matching headings', () => {
      expect(parseDevTasks('## Task 1: Not a dev task')).toEqual([]);
    });
  });

  describe('missing fields', () => {
    it('handles missing Files field', () => {
      const md = `## Dev Task 1: No files\n**Dependencies**: none\n**Description**: Has no files.`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].files).toEqual([]);
    });

    it('handles missing Dependencies field', () => {
      const md = `## Dev Task 1: No deps\n**Files**: a.ts\n**Description**: Has no deps.`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].dependencies).toEqual([]);
    });

    it('handles missing Description field', () => {
      const md = `## Dev Task 1: No desc\n**Files**: a.ts\n**Dependencies**: none`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].description).toBe('');
    });

    it('handles all fields missing', () => {
      const md = `## Dev Task 5: Bare task`;
      const tasks = parseDevTasks(md);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual<ParsedSubtask>({
        index: 5,
        title: 'Bare task',
        files: [],
        description: '',
        dependencies: [],
      });
    });
  });

  describe('formatting variations', () => {
    it('handles fields without bold markers', () => {
      const md = `## Dev Task 1: Plain fields\nFiles: a.ts, b.ts\nDependencies: none\nDescription: Plain text.`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].files).toEqual(['a.ts', 'b.ts']);
      expect(tasks[0].description).toBe('Plain text.');
    });

    it('handles extra whitespace in heading', () => {
      const md = `##   Dev  Task   1  :   Spaced out title  \n**Description**: desc`;
      const tasks = parseDevTasks(md);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Spaced out title');
    });

    it('handles extra whitespace in file list', () => {
      const md = `## Dev Task 1: Spaced files\n**Files**:   a.ts ,  b.ts  , c.ts  `;
      const tasks = parseDevTasks(md);
      expect(tasks[0].files).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('is case-insensitive for field labels', () => {
      const md = `## Dev Task 1: CI check\nfiles: ci.ts\ndependencies: none\ndescription: case insensitive.`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].files).toEqual(['ci.ts']);
      expect(tasks[0].description).toBe('case insensitive.');
    });
  });

  describe('dependency parsing', () => {
    it('parses "none" as empty dependencies', () => {
      const md = `## Dev Task 1: T\n**Dependencies**: none`;
      expect(parseDevTasks(md)[0].dependencies).toEqual([]);
    });

    it('parses single "Dev Task N" reference', () => {
      const md = `## Dev Task 2: T\n**Dependencies**: Dev Task 1`;
      expect(parseDevTasks(md)[0].dependencies).toEqual([1]);
    });

    it('parses multiple "Dev Task N" references', () => {
      const md = `## Dev Task 4: T\n**Dependencies**: Dev Task 1, Dev Task 3`;
      expect(parseDevTasks(md)[0].dependencies).toEqual([1, 3]);
    });

    it('parses bare numbers', () => {
      const md = `## Dev Task 4: T\n**Dependencies**: 1, 3`;
      expect(parseDevTasks(md)[0].dependencies).toEqual([1, 3]);
    });

    it('handles mixed formats', () => {
      const md = `## Dev Task 5: T\n**Dependencies**: Dev Task 1, 3`;
      expect(parseDevTasks(md)[0].dependencies).toEqual([1, 3]);
    });
  });

  describe('non-sequential indices', () => {
    it('preserves the original index from the heading', () => {
      const md = `## Dev Task 3: Third\n**Description**: Third task.\n\n## Dev Task 7: Seventh\n**Description**: Seventh task.`;
      const tasks = parseDevTasks(md);
      expect(tasks[0].index).toBe(3);
      expect(tasks[1].index).toBe(7);
    });
  });
});
