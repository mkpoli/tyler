import fs from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

import chalk from "chalk";
import inquirer from "inquirer";
import semver from "semver";

import { getTypstIndexPackageMetadata } from "@/build/package";
import type { Command } from "@/cli/commands/types";
import { fileExists } from "@/utils/file";
import { stringifyToml } from "@/utils/manifest";

type InitMode = "init" | "create";
type PackageType = "library" | "template";
type DestinationMode = "current" | "explicit" | "derived-new";

type InitOptions = {
	target?: string;
	default?: boolean;
	noPrompt?: boolean;
	current?: boolean;
	newFolder?: boolean;
	force?: boolean;
	type?: PackageType;
	plugin?: boolean;
	name?: string;
	version?: string;
	description?: string;
	author?: string | string[];
	license?: string;
	repository?: string;
	homepage?: string;
	keywords?: string;
	categories?: string;
	disciplines?: string;
	compiler?: string;
};

type InitAnswers = {
	name: string;
	version: string;
	description: string;
	authors: string[];
	license: string;
	repository?: string;
	homepage?: string;
	type: PackageType;
	plugin: boolean;
	keywords: string[];
	categories: string[];
	disciplines: string[];
	compiler?: string;
};

const VALID_CATEGORIES = [
	"model",
	"paper",
	"presentation",
	"utility",
	"thesis",
	"visualization",
	"components",
	"office",
	"text",
	"languages",
	"fun",
	"report",
	"scripting",
	"cv",
	"book",
	"layout",
	"flyer",
	"integration",
	"poster",
];

const VALID_DISCIPLINES = [
	"computer-science",
	"engineering",
	"physics",
	"chemistry",
	"biology",
	"mathematics",
	"linguistics",
	"business",
	"communication",
	"transportation",
	"education",
	"theology",
	"design",
	"law",
	"philosophy",
	"agriculture",
	"economics",
	"anthropology",
	"history",
	"medicine",
	"geology",
	"literature",
	"journalism",
	"geography",
	"music",
	"archaeology",
	"psychology",
	"architecture",
	"drawing",
	"fashion",
	"film",
	"painting",
	"photography",
	"politics",
	"sociology",
	"theater",
];

const DEFAULT_LICENSE = "MIT";
const DEFAULT_VERSION = "0.1.0";

function initCommand(mode: InitMode): Command<InitOptions> {
	const createsNewFolder = mode === "create";

	return {
		name: mode,
		description:
			mode === "init"
				? "Initialize a Typst package in the current or selected directory"
				: "Create a new Typst package project",
		options: [
			{
				name: "target",
				description: "Directory to initialize or create",
				type: String,
				defaultOption: true,
				hide: true,
			},
			{
				name: "default",
				description: "Use recommended defaults and skip prompts",
				type: Boolean,
				alias: "y",
			},
			{
				name: "no-prompt",
				description: "Do not prompt; use CLI values and defaults",
				type: Boolean,
			},
			{
				name: "current",
				description: "Initialize the current directory",
				type: Boolean,
			},
			{
				name: "new-folder",
				description: "Create and initialize a new folder",
				type: Boolean,
			},
			{
				name: "force",
				description:
					"Write into a non-empty directory and overwrite starter files",
				type: Boolean,
				alias: "f",
			},
			{
				name: "type",
				description: `[${chalk.green("library")}|${chalk.green("template")}] Package starter type`,
				type: String,
			},
			{
				name: "plugin",
				description: "Include a WebAssembly plugin scaffold",
				type: Boolean,
			},
			{
				name: "name",
				description: "Package name in kebab-case",
				type: String,
			},
			{
				name: "version",
				description: "Initial package version",
				type: String,
			},
			{
				name: "description",
				description: "Short Typst Universe description",
				type: String,
			},
			{
				name: "author",
				description: "Package author; can be repeated",
				type: String,
				multiple: true,
			},
			{
				name: "license",
				description: "SPDX license expression",
				type: String,
			},
			{
				name: "repository",
				description: "Repository URL",
				type: String,
			},
			{
				name: "homepage",
				description: "Homepage URL",
				type: String,
			},
			{
				name: "keywords",
				description: "Comma-separated package keywords",
				type: String,
			},
			{
				name: "categories",
				description: "Comma-separated Typst Universe categories",
				type: String,
			},
			{
				name: "disciplines",
				description: "Comma-separated Typst Universe disciplines",
				type: String,
			},
			{
				name: "compiler",
				description: "Minimum Typst compiler version",
				type: String,
			},
		],
		usage: `[target] [options]${createsNewFolder ? "" : ""}`,
		async run(options): Promise<void> {
			await runInit(mode, options);
		},
	};
}

async function runInit(mode: InitMode, options: InitOptions): Promise<void> {
	const noPrompt = options.default || options.noPrompt;
	const packageIndex = noPrompt ? [] : await safeGetPackageIndex();
	const defaults = makeDefaults(mode, options);
	const answers = noPrompt
		? defaults
		: await promptForPackage(defaults, packageIndex);
	const projectDirectory = await resolveProjectDirectory(
		mode,
		options,
		answers,
	);

	await ensureDirectoryWritable(projectDirectory, options.force, noPrompt);
	await writeStarterProject(projectDirectory, answers);

	console.info(
		`[Tyler] Initialized ${chalk.green(answers.name)} in ${chalk.gray(projectDirectory)}`,
	);
	console.info(
		`[Tyler] Next: ${chalk.cyan(`tyler check ${projectDirectory}`)}`,
	);
}

async function safeGetPackageIndex() {
	try {
		return await getTypstIndexPackageMetadata();
	} catch (error) {
		console.warn(
			`[Tyler] ${chalk.yellow("Warning:")} Could not fetch Typst package index for suggestions: ${error}`,
		);
		return [];
	}
}

function makeDefaults(mode: InitMode, options: InitOptions): InitAnswers {
	const destinationMode = resolveDestinationMode(mode, options);
	const baseName = sanitizePackageName(
		options.name ??
			(destinationMode === "explicit" && options.target
				? path.basename(options.target)
				: destinationMode === "current"
					? path.basename(process.cwd())
					: "my-package"),
	);

	return {
		name: baseName || "my-package",
		version: options.version ?? DEFAULT_VERSION,
		description: options.description ?? "Provide reusable document helpers.",
		authors: normalizeAuthors(options.author, ["Your Name"]),
		license: options.license ?? DEFAULT_LICENSE,
		repository: emptyToUndefined(options.repository),
		homepage: emptyToUndefined(options.homepage),
		type: options.type === "template" ? "template" : "library",
		plugin: options.plugin ?? false,
		keywords: parseList(options.keywords),
		categories: parseList(options.categories),
		disciplines: parseList(options.disciplines),
		compiler: emptyToUndefined(options.compiler),
	};
}

async function promptForPackage(
	defaults: InitAnswers,
	packageIndex: Awaited<ReturnType<typeof safeGetPackageIndex>>,
): Promise<InitAnswers> {
	const existingNames = new Set(packageIndex.map((pkg) => pkg.name));
	const popularKeywords = [
		...countValues(packageIndex.flatMap((pkg) => pkg.keywords ?? [])),
	]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 30)
		.map(([keyword]) => keyword);

	const metadata = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message: "Package name",
			default: defaults.name,
			filter: sanitizePackageName,
			validate: (value) => {
				if (!/^[a-z0-9-]+$/.test(value)) {
					return "Use kebab-case with lowercase letters, numbers, and hyphens only";
				}
				if (existingNames.has(value)) {
					return "This package name already exists on Typst Universe";
				}
				return true;
			},
		},
		{
			type: "input",
			name: "version",
			message: "Initial version",
			default: defaults.version,
			validate: (value) =>
				semver.valid(value) !== null ||
				"Use a full SemVer version such as 0.1.0",
		},
		{
			type: "input",
			name: "description",
			message: "Short Universe description",
			default: defaults.description,
		},
		{
			type: "input",
			name: "authors",
			message: "Authors (comma-separated)",
			default: defaults.authors.join(", "),
			filter: parseList,
		},
		{
			type: "input",
			name: "license",
			message: "License SPDX expression",
			default: defaults.license,
		},
		{
			type: "input",
			name: "repository",
			message: "Repository URL (optional)",
			default: defaults.repository,
			filter: emptyToUndefined,
		},
		{
			type: "input",
			name: "homepage",
			message: "Homepage URL (optional)",
			default: defaults.homepage,
			filter: emptyToUndefined,
		},
		{
			type: "list",
			name: "type",
			message: "Package type",
			default: defaults.type,
			choices: [
				{ name: "Library", value: "library" },
				{ name: "Template", value: "template" },
			],
		},
		{
			type: "confirm",
			name: "plugin",
			message: "Include a WebAssembly plugin scaffold?",
			default: defaults.plugin,
		},
	]);

	const discovery = await inquirer.prompt([
		{
			type: "checkbox",
			name: "categories",
			message: "Universe categories (up to 3; templates need at least one)",
			default: defaults.categories,
			choices: VALID_CATEGORIES,
			validate: (value: string[]) =>
				value.length <= 3 || "Typst Universe accepts up to three categories",
		},
		{
			type: "checkbox",
			name: "disciplines",
			message: "Target disciplines (optional)",
			default: defaults.disciplines,
			choices: VALID_DISCIPLINES,
		},
		{
			type: "checkbox",
			name: "suggestedKeywords",
			message: "Common Universe keywords to add (optional)",
			choices: popularKeywords,
			when: popularKeywords.length > 0,
		},
		{
			type: "input",
			name: "customKeywords",
			message: "Additional keywords (comma-separated, optional)",
			default: defaults.keywords.join(", "),
			filter: parseList,
		},
		{
			type: "input",
			name: "compiler",
			message: "Minimum Typst compiler version (optional)",
			default: defaults.compiler,
			filter: emptyToUndefined,
			validate: (value) =>
				!value ||
				semver.valid(value) !== null ||
				"Use a full SemVer version such as 0.13.0",
		},
	]);

	return {
		...defaults,
		...metadata,
		keywords: uniqueList([
			...(discovery.suggestedKeywords ?? []),
			...(discovery.customKeywords ?? []),
		]),
		categories: discovery.categories,
		disciplines: discovery.disciplines,
		compiler: discovery.compiler,
	};
}

function resolveDestinationMode(
	mode: InitMode,
	options: InitOptions,
): DestinationMode {
	if (options.current) {
		return "current";
	}

	if (options.newFolder) {
		return options.target ? "explicit" : "derived-new";
	}

	if (options.target) {
		return isCurrentDirectoryTarget(options.target) ? "current" : "explicit";
	}

	return mode === "create" ? "derived-new" : "current";
}

async function resolveProjectDirectory(
	mode: InitMode,
	options: InitOptions,
	answers: InitAnswers,
): Promise<string> {
	const destinationMode = resolveDestinationMode(mode, options);

	if (destinationMode === "current") {
		return path.resolve(options.target ?? ".");
	}

	if (destinationMode === "explicit") {
		return path.resolve(options.target ?? answers.name);
	}

	return await resolveAvailableDirectory(path.resolve(answers.name));
}

async function resolveAvailableDirectory(basePath: string): Promise<string> {
	if (!(await fileExists(basePath))) {
		return basePath;
	}

	for (let index = 2; ; index += 1) {
		const candidate = `${basePath}-${index}`;
		if (!(await fileExists(candidate))) {
			return candidate;
		}
	}
}

function isCurrentDirectoryTarget(target: string): boolean {
	return path.resolve(target) === process.cwd();
}

async function ensureDirectoryWritable(
	projectDirectory: string,
	force?: boolean,
	noPrompt?: boolean,
): Promise<void> {
	if (!(await fileExists(projectDirectory))) {
		await fs.mkdir(projectDirectory, { recursive: true });
		return;
	}

	const entries = await fs.readdir(projectDirectory);
	if (entries.length === 0 || force) {
		return;
	}

	if (noPrompt) {
		throw new Error(
			`[Tyler] ${projectDirectory} is not empty. Re-run with ${chalk.cyan("--force")} to write starter files there.`,
		);
	}

	const {
		continueInNonEmptyDirectory,
	}: { continueInNonEmptyDirectory: boolean } = await inquirer.prompt([
		{
			type: "confirm",
			name: "continueInNonEmptyDirectory",
			message: `${projectDirectory} is not empty. Continue and overwrite starter files if needed?`,
			default: false,
		},
	]);

	if (!continueInNonEmptyDirectory) {
		throw new Error("[Tyler] Cancelled by user");
	}
}

async function writeStarterProject(
	projectDirectory: string,
	answers: InitAnswers,
): Promise<void> {
	await fs.mkdir(path.resolve(projectDirectory, "src"), { recursive: true });

	if (answers.type === "template") {
		await fs.mkdir(path.resolve(projectDirectory, "src", "template"), {
			recursive: true,
		});
	}

	const files: Record<string, string> = {
		"typst.toml": await renderTypstToml(answers),
		"README.md": renderReadme(answers),
		LICENSE: renderLicense(answers),
		".gitignore": "dist\n.DS_Store\n",
		"src/lib.typ": renderLibraryEntrypoint(answers),
	};

	if (answers.plugin) {
		files["src/plugin.typ"] = renderPluginWrapper();
	}

	if (answers.type === "template") {
		files["src/template/main.typ"] = renderTemplateEntrypoint(answers);
	}

	for (const [relativePath, content] of Object.entries(files)) {
		const filePath = path.resolve(projectDirectory, relativePath);
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, content);
	}

	if (answers.type === "template") {
		await fs.writeFile(
			path.resolve(projectDirectory, "thumbnail.png"),
			createPlaceholderPng(1080, 1080),
		);
	}
}

async function renderTypstToml(answers: InitAnswers): Promise<string> {
	const manifest: Record<string, unknown> = {
		package: {
			name: answers.name,
			version: answers.version,
			entrypoint: "lib.typ",
			authors: answers.authors,
			license: answers.license,
			description: answers.description,
		},
		tool: {
			tyler: {
				srcdir: "src",
				outdir: "dist",
				ignore: [],
			},
		},
	};

	const pkg = manifest.package as Record<string, unknown>;
	if (answers.repository) pkg.repository = answers.repository;
	if (answers.homepage) pkg.homepage = answers.homepage;
	if (answers.keywords.length > 0) pkg.keywords = answers.keywords;
	if (answers.categories.length > 0) pkg.categories = answers.categories;
	if (answers.disciplines.length > 0) pkg.disciplines = answers.disciplines;
	if (answers.compiler) pkg.compiler = answers.compiler;

	if (answers.type === "template") {
		manifest.template = {
			path: "template",
			entrypoint: "main.typ",
			thumbnail: "thumbnail.png",
		};

		if (!pkg.categories) {
			pkg.categories = ["layout"];
		}
	}

	return stringifyToml(manifest);
}

function renderLibraryEntrypoint(answers: InitAnswers): string {
	const id = typstIdentifier(answers.name);

	if (answers.plugin) {
		return `// Replace this stub once your WebAssembly plugin is compiled.\n// See src/plugin.typ for setup notes and a wrapper example.\n#let ${id}(body) = body\n`;
	}

	if (answers.type === "template") {
		// Template starter: a proper template function with named arguments,
		// `set` rules, and `///` doc comments — the canonical Typst pattern.
		// See https://typst.app/docs/tutorial/making-a-template/
		return [
			`/// ${answers.description}`,
			`///`,
			`/// - title (str | content): Document title.`,
			`/// - author (str | content): Author name.`,
			`/// - body (content): Document body.`,
			`#let ${id}(`,
			`  title: none,`,
			`  author: none,`,
			`  body,`,
			`) = {`,
			`  set document(`,
			`    title: if type(title) == str { title } else { "" },`,
			`    author: if type(author) == str { author } else { "" },`,
			`  )`,
			`  set page(paper: "a4", margin: 1in)`,
			`  set text(font: "Libertinus Serif", size: 11pt, lang: "en")`,
			`  set par(justify: true, leading: 0.65em)`,
			`  set heading(numbering: "1.1")`,
			``,
			`  // Title block`,
			`  if title != none {`,
			`    align(center, text(size: 17pt, weight: "bold", title))`,
			`    if author != none {`,
			`      v(0.6em)`,
			`      align(center, text(size: 12pt, author))`,
			`    }`,
			`    v(1.2em)`,
			`  }`,
			``,
			`  body`,
			`}`,
			``,
		].join("\n");
	}

	// Library starter: minimal exports, no body wrapper. Library packages
	// typically expose utility functions, not document templates.
	return [
		`/// ${answers.description}`,
		``,
		`/// Greet the world.`,
		`#let hello() = "Hello, world!"`,
		``,
	].join("\n");
}

function renderPluginWrapper(): string {
	return `// Typst WebAssembly plugin notes:\n// - Docs: https://typst.app/docs/reference/foundations/plugin/\n// - Protocol helpers and examples: https://github.com/astrale-sharp/wasm-minimal-protocol\n//\n// Typical workflow:\n// 1. Compile your plugin to src/plugin.wasm\n// 2. Load it with plugin("plugin.wasm")\n// 3. Wrap byte-oriented exports in idiomatic Typst functions\n// 4. Re-export those wrappers from src/lib.typ\n//\n// Example:\n// #let plugin_instance = plugin("plugin.wasm")\n// #let concat(a, b) = str(\n//   plugin_instance.concatenate(bytes(a), bytes(b))\n// )\n`;
}

function renderTemplateEntrypoint(answers: InitAnswers): string {
	const id = typstIdentifier(answers.name);
	const title = titleCase(answers.name);
	return [
		`#import "../lib.typ": ${id}`,
		``,
		`#show: ${id}.with(`,
		`  title: "${title}",`,
		`  author: "Your Name",`,
		`)`,
		``,
		`= Introduction`,
		``,
		`Start writing your document here.`,
		``,
	].join("\n");
}

function renderReadme(answers: InitAnswers): string {
	const importLine =
		answers.type === "template"
			? `typst init @preview/${answers.name}:${answers.version}`
			: `#import "@preview/${answers.name}:${answers.version}": ${typstIdentifier(answers.name)}`;
	const pluginSection = answers.plugin
		? `## WebAssembly Plugin\n\nThis starter is set up for a Typst WebAssembly plugin package. Typst plugins are low-level byte-oriented WebAssembly modules that are usually wrapped in friendly Typst functions.\n\nHelpful references:\n\n- Typst plugin docs: https://typst.app/docs/reference/foundations/plugin/\n- wasm-minimal-protocol examples and helpers: https://github.com/astrale-sharp/wasm-minimal-protocol\n\nSuggested workflow:\n\n1. Build a 32-bit shared WebAssembly module that follows Typst's plugin protocol.\n2. Write the compiled artifact to \`src/plugin.wasm\`.\n3. Replace \`src/plugin.typ\` with a real wrapper around your plugin exports.\n4. Export those wrappers from \`src/lib.typ\`.\n5. Run \`tyler check\` and compile a small Typst example to verify behavior locally.\n\nA plugin package should expose idiomatic Typst functions, not raw byte buffers, whenever possible.\n\n`
		: "";
	const publishSection = `## Publishing\n\nBefore publishing to Typst Universe:\n\n1. Fill in package metadata in \`typst.toml\` and make sure the package name is acceptable for Universe.\n2. Add real documentation to this README and keep \`LICENSE\` in the package root.\n3. Run \`tyler check\` to validate the manifest and package layout.\n4. Run \`tyler build -i\` to install and test locally.\n5. Run \`tyler build -p\` when you are ready to prepare a submission to \`typst/packages\`.\n\nReferences:\n\n- Universe: https://typst.app/universe/\n- Package manifest rules: https://github.com/typst/packages/blob/main/docs/manifest.md\n- Package repository: https://github.com/typst/packages\n`;

	return `# ${titleCase(answers.name)}\n\n${answers.description}\n\n## Usage\n\n\`\`\`typst\n${importLine}\n\`\`\`\n\n${pluginSection}${publishSection}`;
}

function renderLicense(answers: InitAnswers): string {
	const author = answers.authors[0] ?? "the authors";
	if (answers.license !== "MIT") {
		return `${answers.license}\n\nCopyright (c) ${new Date().getFullYear()} ${author}\n`;
	}

	return `MIT License\n\nCopyright (c) ${new Date().getFullYear()} ${author}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
}

function createPlaceholderPng(
	width: number,
	height: number,
): Uint8Array<ArrayBuffer> {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	const rowLength = 1 + width * 3;
	const raw = Buffer.alloc(rowLength * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * rowLength] = 0;
		for (let x = 0; x < width; x += 1) {
			const offset = y * rowLength + 1 + x * 3;
			raw[offset] = 246;
			raw[offset + 1] = 241;
			raw[offset + 2] = 232;
		}
	}

	return bufferToUint8Array(
		concatBuffers([
			signature,
			pngChunk("IHDR", ihdr),
			pngChunk("IDAT", deflateSync(bufferToUint8Array(raw))),
			pngChunk("IEND", Buffer.alloc(0)),
		]),
	);
}

function pngChunk(type: string, data: Buffer): Buffer {
	const typeBuffer = Buffer.from(type, "ascii");
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(concatBuffers([typeBuffer, data])), 0);
	return concatBuffers([length, typeBuffer, data, crc]);
}

function concatBuffers(buffers: Buffer[]): Buffer {
	return Buffer.concat(buffers as unknown as Uint8Array[]);
}

function crc32(buffer: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function bufferToUint8Array(buffer: Buffer): Uint8Array<ArrayBuffer> {
	const arrayBuffer = buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;
	return new Uint8Array(arrayBuffer);
}

function normalizeAuthors(
	author?: string | string[],
	fallback: string[] = [],
): string[] {
	if (Array.isArray(author)) {
		return author.flatMap(parseList);
	}
	const authors = parseList(author);
	return authors.length > 0 ? authors : fallback;
}

function parseList(value?: string): string[] {
	return uniqueList(
		(value ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
	);
}

function uniqueList(values: string[]): string[] {
	return [...new Set(values)];
}

function emptyToUndefined(value?: string): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function sanitizePackageName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function typstIdentifier(value: string): string {
	return sanitizePackageName(value).replace(/-/g, "_") || "package";
}

function titleCase(value: string): string {
	return value
		.split("-")
		.filter(Boolean)
		.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
		.join(" ");
}

function countValues(values: string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return counts;
}

export const init = initCommand("init");
export const create = initCommand("create");
