import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";
import { minimatch } from "minimatch";
import semver from "semver";
import * as toml from "smol-toml";

import {
	type TypstToml,
	getTypstIndexPackageMetadata,
	readTypstToml,
} from "@/build/package";
import { bumpVersion, interactivelyBumpVersion } from "@/cli/bump";
import type { Command } from "@/cli/commands/types";
import { type Config, updateOptionFromConfig } from "@/cli/config";
import {
	clearDirectoryWithoutDeletingIt,
	fileExists,
	getWorkingDirectory,
} from "@/utils/file";

export default {
	name: "build",
	description: "Bump the version and build a Typst package",
	options: [
		{
			name: "entrypoint",
			description:
				"The entrypoint `typst.toml` or the directory with it to build",
			type: String,
			defaultOption: true,
			hide: true,
		},
		{
			name: "bump",
			description: `[${chalk.green("major")}|${chalk.green("minor")}|${chalk.green(
				"patch",
			)}|${chalk.green("skip")}|${chalk.blue("string")}] The version to bump to: semver bump, skip as-is, or specify a custom version`,
			type: String,
			alias: "b",
		},
		{
			name: "dry-run",
			description:
				"Preview the build process without actually modifying anything",
			type: Boolean,
			alias: "d",
		},
		{
			name: "no-bump",
			description: "Do not bump the version",
			type: Boolean,
			alias: "n",
		},
		{
			name: "srcdir",
			description: "The source directory where the source code is located",
			type: String,
			alias: "s",
		},
		{
			name: "outdir",
			description:
				"The output directory where the compiled package will be placed",
			type: String,
			alias: "o",
		},
		{
			name: "ignore",
			description: "The files to ignore in the output directory",
			type: String,
			alias: "i",
		},
	],
	usage: "<entrypoint> [options]",
	async run(options): Promise<void> {
		// #region Working directory
		const workingDirectory =
			options.entrypoint === undefined
				? process.cwd()
				: await getWorkingDirectory(options.entrypoint as string | undefined);

		console.info(
			`[Tyler]${options.dryRun ? chalk.gray(" (dry-run) ") : " "}Building package in ${chalk.gray(workingDirectory)}...`,
		);
		// #endregion

		// #region Read typst.toml
		const typstTomlPath = path.resolve(workingDirectory, "typst.toml");
		if (!(await fileExists(typstTomlPath))) {
			throw new Error(`[Tyler] ${typstTomlPath} not found`);
		}

		const typstToml: TypstToml = await readTypstToml(typstTomlPath);

		console.info(
			`[Tyler] Loaded ${chalk.green("typst.toml")} for package ${chalk.yellow(typstToml.package.name)}:${chalk.gray(
				typstToml.package.version,
			)}`,
		);
		// #endregion

		// #region Update options
		if (typstToml.tool?.tyler) {
			console.info(
				`[Tyler] Found ${chalk.green("[tool.tyler]")} in package's ${chalk.gray("typst.toml")}`,
			);
		}

		let updatedOptions = updateOptionFromConfig(
			options,
			typstToml.tool?.tyler ?? ({} as Partial<Config>),
		);
		// #endregion

		// #region Get index package metadata
		const versionIndex = await getTypstIndexPackageMetadata();
		const samePackageName = versionIndex.find(
			({ name }) => name === typstToml.package.name,
		);

		if (!samePackageName) {
			console.info(
				`[Tyler] Building for a unpublished package ${chalk.yellow(typstToml.package.name)}...`,
			);

			if (!semver.valid(typstToml.package.version)) {
				console.warn(
					`[Tyler] The version of the package is not a valid semver: ${chalk.gray(
						typstToml.package.version,
					)}`,
				);
			}

			if (semver.compare(typstToml.package.version, "0.1.0") > 0) {
				console.warn(
					`[Tyler] The version of the package (${chalk.gray(
						typstToml.package.version,
					)}) is more than 0.1.0 before bump while being unpublished`,
				);
			}
		}
		// #endregion

		// #region Get bumped version
		const bumpedVersion = options.bump
			? bumpVersion(typstToml.package.version, options.bump)
			: await interactivelyBumpVersion(typstToml.package.version);

		if (bumpedVersion === typstToml.package.version) {
			console.info(
				`[Tyler] The version of the package is not changed: ${chalk.gray(bumpedVersion)}`,
			);
		}

		if (samePackageName?.version === bumpedVersion) {
			console.warn("[Tyler] The version of the package is already published");
		}
		// #endregion

		// #region Bump the version in typst.toml
		const typstTomlOutWithoutToolTylerWithBumpedVersion = {
			...typstToml,
			package: { ...typstToml.package, version: bumpedVersion },
			tool: typstToml.tool
				? { ...typstToml.tool, tyler: undefined }
				: undefined,
		};

		if (options.dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would bump version in ${chalk.yellow(path.relative(workingDirectory, typstTomlPath))}`,
			);
		} else {
			const updatedOriginalTypstTomlData = {
				...typstToml,
				package: { ...typstToml.package, version: bumpedVersion },
			};
			await fs.writeFile(
				typstTomlPath,
				toml.stringify(updatedOriginalTypstTomlData),
			);
			console.info(
				`[Tyler] Bumped version in ${chalk.green("typst.toml")} to ${chalk.yellow(path.relative(workingDirectory, typstTomlPath))}`,
			);
		}
		// #endregion

		// #region Get source directory
		const sourceDir = !updatedOptions.srcdir
			? path.resolve(workingDirectory, "src")
			: path.isAbsolute(updatedOptions.srcdir)
				? updatedOptions.srcdir
				: path.resolve(workingDirectory, updatedOptions.srcdir);

		if (!(await fileExists(sourceDir))) {
			throw new Error(
				`[Tyler] Source directory not found: ${chalk.gray(sourceDir)}`,
			);
		}
		console.info(`[Tyler] Source directory found in ${chalk.gray(sourceDir)}`);
		// #endregion

		// #region Get output directory
		const outputDir = !updatedOptions.outdir
			? path.resolve(workingDirectory, "dist")
			: path.isAbsolute(updatedOptions.outdir)
				? updatedOptions.outdir
				: path.resolve(workingDirectory, updatedOptions.outdir);
		console.info(`[Tyler] Output directory will be  ${chalk.gray(outputDir)}`);
		// #endregion

		// #region Get entrypoint
		const entrypoint = typstToml.package.entrypoint ?? "lib.typ";
		// #endregion

		// #region Create and clear output directory
		if (!options.dryRun) {
			await fs.mkdir(outputDir, { recursive: true });
			await clearDirectoryWithoutDeletingIt(outputDir);
		}
		// #endregion

		// #region Remove tool.tyler from typst.toml and copy it to output directory
		const distTypstTomlPath = path.resolve(outputDir, "typst.toml");
		if (options.dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would copy ${chalk.green("typst.toml")} to ${chalk.yellow(path.relative(workingDirectory, distTypstTomlPath))}${typstToml.tool?.tyler ? " without tool.tyler " : ""}`,
			);
		} else {
			const outputTypstTomlData = {
				...typstTomlOutWithoutToolTylerWithBumpedVersion,
				tool: undefined,
			};
			await fs.writeFile(
				distTypstTomlPath,
				toml.stringify(outputTypstTomlData),
			);
			console.info(
				`[Tyler] Copied ${chalk.green("typst.toml")} to ${chalk.yellow(path.relative(workingDirectory, distTypstTomlPath))}`,
			);
		}
		// #endregion

		// #region Copy meta files (README.md, LICENSE)
		async function copyMetaFiles(
			name: string,
			mandatory: boolean,
		): Promise<void> {
			if (await fileExists(path.resolve(workingDirectory, name))) {
				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would copy ${chalk.green(name)} to ${chalk.yellow(path.relative(workingDirectory, outputDir))}`,
					);
				} else {
					await fs.copyFile(
						path.resolve(workingDirectory, name),
						path.resolve(outputDir, name),
					);
					console.info(
						`[Tyler] Copied ${chalk.green(name)} to ${chalk.yellow(path.relative(workingDirectory, outputDir))}`,
					);
				}
			} else {
				console.warn(
					`[Tyler] ${chalk.gray(name)} is required but not found in ${chalk.gray(workingDirectory)}`,
				);
			}
		}

		await copyMetaFiles("README.md", true);
		await copyMetaFiles("LICENSE", false);
		// #endregion

		// #region Replace entrypoint in templates
		const modifiedFiles: Record<string, string> = {};

		// copy typst.toml
		if (typstToml.template) {
			const templatePath = path.resolve(sourceDir, typstToml.template.path);
			const templateFiles = await fs.readdir(templatePath, { recursive: true });

			for (const templateFile of templateFiles) {
				const libraryEntrypointRelativeToTemplateFile = path.relative(
					templateFile,
					entrypoint,
				);
				const content = await fs.readFile(
					path.resolve(templatePath, templateFile),
					"utf8",
				);

				const templateFileRelativeToSrcDir = path.relative(
					sourceDir,
					templateFile,
				);

				if (
					content.includes(
						`import "${libraryEntrypointRelativeToTemplateFile}"`,
					)
				) {
					modifiedFiles[templateFileRelativeToSrcDir] = content.replace(
						`import "${libraryEntrypointRelativeToTemplateFile}"`,
						`import "@preview/${typstToml.package.name}:${typstToml.package.version}"`,
					);
				}
			}
		}
		// #endregion

		// #region Copy all files in source directory to output directory while applying modified files
		const allFiles = await fs.readdir(sourceDir, { recursive: true });

		for (const file of allFiles) {
			if (updatedOptions.ignore?.some((ignore) => minimatch(file, ignore))) {
				console.info(
					`[Tyler] Ignoring ${chalk.gray(file)} because it matches ${updatedOptions.ignore?.map((ignore) => chalk.gray(ignore)).join(", ")}`,
				);
				continue;
			}

			if (modifiedFiles[file]) {
				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run) ")} Would write ${chalk.green(path.relative(workingDirectory, file))} to ${chalk.yellow(path.relative(workingDirectory, outputDir))}`,
					);
					continue;
				}
				await fs.writeFile(path.resolve(outputDir, file), modifiedFiles[file]);
				console.info(
					`[Tyler] Copied modified version of ${chalk.green(path.relative(workingDirectory, file))} to ${chalk.yellow(path.relative(workingDirectory, outputDir))}`,
				);
			} else {
				const sourceFilePath = path.resolve(sourceDir, file);
				const outputFilePath = path.resolve(outputDir, file);

				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would copy ${chalk.green(path.relative(workingDirectory, sourceFilePath))} to ${chalk.yellow(path.relative(workingDirectory, outputFilePath))}`,
					);
				} else {
					await fs.cp(sourceFilePath, outputFilePath, { recursive: true });
					console.info(
						`[Tyler] Copied ${chalk.green(path.relative(workingDirectory, sourceFilePath))} to ${chalk.yellow(path.relative(workingDirectory, outputFilePath))}`,
					);
				}
			}
		}
		// #endregion
	},
} satisfies Command<{
	entrypoint: string | undefined;
	bump: string | undefined;
	dryRun: boolean | undefined;
	noBump: boolean | undefined;
	srcdir: string | undefined;
	outdir: string | undefined;
	ignore: string | undefined;
}>;
