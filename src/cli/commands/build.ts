import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import chalk from "chalk";
import { minimatch } from "minimatch";
import semver from "semver";

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
	getDataDirectory,
	getWorkingDirectory,
} from "@/utils/file";
import { execAndRedirect } from "@/utils/process";

import { stringifyToml } from "@/utils/manifest";
import check from "./check";

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
		},
		{
			name: "install",
			description: "Install the built package to Typst local package group",
			type: Boolean,
			defaultValue: false,
			alias: "i",
		},
		{
			name: "publish",
			description:
				"Publish the built package to the Typst preview package index",
			type: Boolean,
			defaultValue: false,
			alias: "p",
		},
		{
			name: "no-check",
			description: "Do not check the package before building",
			type: Boolean,
		},
	],
	usage: "<entrypoint> [options]",
	async run(options): Promise<void> {
		if (!options.noCheck) {
			await check.run(options);
		}

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

		const updatedOptions = updateOptionFromConfig(
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
				await stringifyToml(updatedOriginalTypstTomlData),
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
				await stringifyToml(outputTypstTomlData),
			);
			console.info(
				`[Tyler] Copied ${chalk.green("typst.toml")} to ${chalk.yellow(path.relative(workingDirectory, distTypstTomlPath))}`,
			);
		}
		// #endregion

		// #region Copy meta files (README.md, LICENSE)
		async function copyMetaFiles(name: string): Promise<void> {
			if (await fileExists(path.resolve(workingDirectory, name))) {
				const sourceFilePath = path.resolve(workingDirectory, name);
				const relativeSourceFilePath = path.relative(
					workingDirectory,
					sourceFilePath,
				);

				const outputFilePath = path.resolve(outputDir, name);
				const relativeOutputFilePath = path.relative(
					workingDirectory,
					outputFilePath,
				);
				await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would copy ${chalk.green(relativeSourceFilePath)} to ${chalk.yellow(relativeOutputFilePath)}`,
					);
				} else {
					await fs.copyFile(sourceFilePath, outputFilePath);
					console.info(
						`[Tyler] Copied ${chalk.green(relativeSourceFilePath)} to ${chalk.yellow(relativeOutputFilePath)}`,
					);
				}
			} else {
				console.warn(
					`[Tyler] ${chalk.gray(name)} is required but not found in ${chalk.gray(workingDirectory)}`,
				);
			}
		}

		await copyMetaFiles("README.md");
		await copyMetaFiles("LICENSE");

		if (typstTomlOutWithoutToolTylerWithBumpedVersion.template?.thumbnail) {
			await copyMetaFiles(
				typstTomlOutWithoutToolTylerWithBumpedVersion.template.thumbnail,
			);
		}
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

				const relativeTemplateFilePath = path.relative(
					sourceDir,
					path.resolve(templatePath, templateFile),
				);

				if (
					content.includes(
						`import "${libraryEntrypointRelativeToTemplateFile}"`,
					)
				) {
					modifiedFiles[relativeTemplateFilePath] = content.replace(
						`import "${libraryEntrypointRelativeToTemplateFile}"`,
						`import "@preview/${typstToml.package.name}:${bumpedVersion}"`,
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
				const outputFilePath = path.resolve(outputDir, file);
				await fs.writeFile(outputFilePath, modifiedFiles[file]);
				console.info(
					`[Tyler] Copied modified version of ${chalk.green(file)} to ${chalk.yellow(path.relative(workingDirectory, outputFilePath))}`,
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

		// #region Install the built package to Typst local package group
		if (options.install) {
			// copy all files in to
			const localPackagesDirectory = path.resolve(
				await getDataDirectory(),
				"typst",
				"packages",
				"local",
			);
			const currentPackageDirectory = path.resolve(
				localPackagesDirectory,
				typstTomlOutWithoutToolTylerWithBumpedVersion.package.name,
				typstTomlOutWithoutToolTylerWithBumpedVersion.package.version,
			);

			if (options.dryRun) {
				console.info(
					`[Tyler] ${chalk.gray("(dry-run)")} Would install to ${chalk.yellow(path.relative(workingDirectory, currentPackageDirectory))}`,
				);
			} else {
				await fs.mkdir(currentPackageDirectory, { recursive: true });
				await fs.cp(outputDir, currentPackageDirectory, { recursive: true });
				console.info(
					`[Tyler] Installed to ${chalk.yellow(currentPackageDirectory)}`,
				);
			}
		}
		// #endregion

		// #region Publish the built package to the Typst preview package index
		if (options.publish) {
			const builtPackageName =
				typstTomlOutWithoutToolTylerWithBumpedVersion.package.name;
			const builtPackageVersion =
				typstTomlOutWithoutToolTylerWithBumpedVersion.package.version;

			// - Make a temporary directory
			const tempDirPath = path.join(os.tmpdir(), "tyler-publish");
			if (options.dryRun) {
				console.info(
					`[Tyler] ${chalk.gray("(dry-run)")} Would make a temporary directory in ${chalk.gray(tempDirPath)}`,
				);
			} else {
				await fs.mkdir(tempDirPath, { recursive: true });
				console.info(
					`[Tyler] Made a temporary directory in ${chalk.gray(tempDirPath)}`,
				);
			}

			// - Clone github:typst/packages
			const gitRepoUrl = "https://github.com/typst/packages.git";
			const gitRepoDir = path.join(tempDirPath, "packages");

			const isGitRepo = await fileExists(path.join(gitRepoDir, ".git"));
			if (!isGitRepo) {
				// - Remove the directory
				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would remove ${chalk.gray(gitRepoDir)}`,
					);
				} else {
					await fs.rm(gitRepoDir, { recursive: true });
					console.info(`[Tyler] Removed ${chalk.gray(gitRepoDir)}`);
				}
			}

			if (!(await fileExists(gitRepoDir))) {
				const cloneCommand = `git clone ${gitRepoUrl} ${gitRepoDir} --depth 1`;

				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would clone ${chalk.gray(gitRepoUrl)} into ${chalk.gray(gitRepoDir)}`,
					);
				} else {
					try {
						await execAndRedirect(cloneCommand);
						console.info(
							`[Tyler] Cloned ${chalk.gray(gitRepoUrl)} into ${chalk.gray(gitRepoDir)}`,
						);
					} catch (error) {
						if (error instanceof Error) {
							console.info(
								`[Tyler] ${chalk.red("Error cloning repository:")} ${error.message}`,
							);
						}
					}
				}
			} else {
				// - Clean up git working tree
				if (options.dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would clean up git working tree in ${chalk.gray(gitRepoDir)}`,
					);
				} else {
					const cleanCommand = `git -C ${gitRepoDir} reset --hard HEAD`;
					await execAndRedirect(cleanCommand);
				}

				// - Fetch the latest changes from origin
				const fetchCommand = `git -C ${gitRepoDir} fetch origin`;
				await execAndRedirect(fetchCommand);

				// - Create a new branch from origin/main
				const createBranchCommand = `git -C ${gitRepoDir} checkout -b ${builtPackageName}-${builtPackageVersion} origin/main`;
				await execAndRedirect(createBranchCommand);
			}

			// - Copy the built package to the cloned repository
			const packageDir = path.join(
				gitRepoDir,
				"packages",
				"preview",
				builtPackageName,
				builtPackageVersion,
			);
			if (options.dryRun) {
				console.info(
					`[Tyler] ${chalk.gray("(dry-run)")} Would copy files from ${chalk.gray(outputDir)} to ${chalk.gray(packageDir)}`,
				);
			} else {
				await fs.mkdir(packageDir, { recursive: true });
				await fs.cp(outputDir, packageDir, { recursive: true });
				console.info(
					`[Tyler] Copied files from ${chalk.gray(outputDir)} to ${chalk.gray(packageDir)}`,
				);
			}

			// - Stage, commit and push the built package to the cloned repository
			const stageCommand = `git -C ${gitRepoDir} add packages/preview/${builtPackageName}/${builtPackageVersion}`;
			const commitCommand = `git -C ${gitRepoDir} commit -m ${builtPackageName}@${builtPackageVersion}`;

			if (options.dryRun) {
				console.info(
					`[Tyler] ${chalk.gray("(dry-run)")} Would run ${chalk.gray(stageCommand)}`,
				);
			} else {
				await execAndRedirect(stageCommand);
				console.info(`[Tyler] Ran ${chalk.gray(stageCommand)}`);
			}

			if (options.dryRun) {
				console.info(
					`[Tyler] ${chalk.gray("(dry-run)")} Would run ${chalk.gray(commitCommand)}`,
				);
			} else {
				await execAndRedirect(commitCommand);
				console.info(`[Tyler] Ran ${chalk.gray(commitCommand)}`);
			}

			// - Show instructions on how to publish the package
			if (options.publish) {
				// -- Check if gh is installed
				let ghInstalled = false;
				try {
					await execAndRedirect("gh --version");
					ghInstalled = true;
				} catch (error) {
					ghInstalled = false;
				}

				// -- If gh is not installed, show instructions on how to install it
				if (!ghInstalled) {
					console.info(
						"[Tyler] To publish the package from command line, you can install GitHub CLI: https://cli.github.com/manual/installation",
					);
				}

				// -- Show the command to create a pull request
				console.info(
					`[Tyler] To publish the package, run the following commands (if you are not already logged in via GitHub CLI, run \`${chalk.bold("gh")} ${chalk.green("auth login")}\` first):`,
				);
				console.info(
					`  ${chalk.cyan("$")} ${chalk.bold("cd")} ${chalk.gray(gitRepoDir)}`,
				);
				console.info(
					`  ${chalk.cyan("$")} ${chalk.bold("gh")} ${chalk.green("repo set-default")} ${chalk.gray(gitRepoUrl)}`,
				);
				console.info(
					`  ${chalk.cyan("$")} ${chalk.bold("gh")} ${chalk.green("pr create")} --title ${chalk.gray(`"${builtPackageName}:${builtPackageVersion}"`)} --body-file ${chalk.gray('".github/pull_request_template.md"')} --draft`,
				);
				console.info(
					`  ${chalk.cyan("$")} ${chalk.bold("cd")} ${chalk.gray("-")}`,
				);
				console.info(
					`Then go to your draft pull request on GitHub (following the link similar to ${chalk.gray(
						"https://github.com/typst/packages/pull/<number>",
					)} from the output of the command above) and fill in the details to wait for the package to be approved`,
				);
			}
		}
	},
} satisfies Command<{
	entrypoint: string | undefined;
	bump: string | undefined;
	dryRun: boolean | undefined;
	noBump: boolean | undefined;
	srcdir: string | undefined;
	outdir: string | undefined;
	ignore: string | undefined;
	install: boolean | undefined;
	publish: boolean | undefined;
	noCheck: boolean | undefined;
}>;
