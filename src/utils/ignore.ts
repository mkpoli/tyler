import path from "node:path";

import { minimatch } from "minimatch";

const MINIMATCH_OPTS = { dot: true } as const;

/**
 * Patterns Tyler always skips when copying srcdir into outdir.
 * These are version control, editor, and OS metadata that should never
 * be shipped to the Typst package index.
 */
const ALWAYS_IGNORE = [
	".git",
	"node_modules",
	".DS_Store",
	"**/.DS_Store",
	".vscode",
	".idea",
	"Thumbs.db",
];

/**
 * Decide whether a relative path produced by `fs.readdir(..., { recursive: true })`
 * should be skipped. Matches both the entry itself and any descendant of it,
 * so a literal pattern like `node_modules` covers `node_modules/foo/bar.ts` too,
 * and a glob like `examples/**` also matches the bare `examples` directory entry
 * (otherwise `fs.cp` would recursively copy it before we filter its children).
 */
export function shouldIgnore(file: string, patterns: string[]): boolean {
	const normalised = file.split(path.sep).join("/");
	return patterns.some((pattern) => {
		if (minimatch(normalised, pattern, MINIMATCH_OPTS)) return true;
		// Treat a directory pattern as also matching its descendants.
		if (minimatch(normalised, `${pattern}/**`, MINIMATCH_OPTS)) return true;
		// Treat `<base>/**` as also matching the bare directory entry, so
		// `examples/**` skips the `examples` dir as well as its children.
		if (pattern.endsWith("/**")) {
			const base = pattern.slice(0, -3);
			if (base && minimatch(normalised, base, MINIMATCH_OPTS)) return true;
		}
		return false;
	});
}

/**
 * Patterns that should always apply on top of user-supplied excludes,
 * including the relative path from srcdir to outdir when outdir is nested
 * inside srcdir (which is typical when srcdir is the repository root).
 */
export function computeDefaultIgnores(
	sourceDir: string,
	outputDir: string,
): string[] {
	const defaults = [...ALWAYS_IGNORE];

	const relativeOutput = path.relative(sourceDir, outputDir);
	if (
		relativeOutput &&
		!relativeOutput.startsWith("..") &&
		!path.isAbsolute(relativeOutput)
	) {
		defaults.push(relativeOutput.split(path.sep).join("/"));
	}

	return [...new Set(defaults)];
}

/** Union of user `ignore`, manifest `package.exclude`, and computed defaults. */
export function combineIgnorePatterns(
	...lists: (readonly string[] | undefined)[]
): string[] {
	const all: string[] = [];
	for (const list of lists) {
		if (!list) continue;
		for (const item of list) {
			if (item && !all.includes(item)) all.push(item);
		}
	}
	return all;
}
