// Check if thumbnail.png exists

import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";
import imageSize from "image-size";
import imageType from "image-type";
import { minimatch } from "minimatch";
import semver from "semver";
import spdxExpressionValidate from "spdx-expression-validate";
import validUrl from "valid-url";

import {
	getTypstIndexPackageMetadata,
	readTypstToml,
	type TypstToml,
} from "@/build/package";
import type { Command } from "@/cli/commands/types";
import { type Config, updateOptionFromConfig } from "@/cli/config";
import { fileExists, getWorkingDirectory } from "@/utils/file";

export default {
	name: "check",
	description: "Check the current package for errors",
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
			name: "write",
			description: "Write the result to a file",
			type: String,
		},
	],
	usage: "<entrypoint> [options]",
	async run(options): Promise<void> {
		// #region Get working directory
		const workingDirectory =
			options.entrypoint === undefined
				? process.cwd()
				: await getWorkingDirectory(options.entrypoint as string | undefined);

		console.info(
			`[Tyler] Checking package in ${chalk.gray(workingDirectory)}...`,
		);
		// #endregion

		// #region Read typst.toml
		const typstTomlPath = path.resolve(workingDirectory, "typst.toml");
		if (!(await fileExists(typstTomlPath))) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.red(typstTomlPath)} not found`,
			);
			return;
		}

		const typstToml: TypstToml = await readTypstToml(typstTomlPath);

		if (!typstToml.package) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.red("typst.toml")} is missing required ${chalk.red("package")} section`,
			);
			return;
		}

		console.info(
			`[Tyler] Loaded ${chalk.green("typst.toml")} for package ${chalk.yellow(typstToml.package.name)}:${chalk.gray(
				typstToml.package.version,
			)}`,
		);
		// #endregion

		// #region Check package.name
		if (!typstToml.package.name) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.red("typst.toml")} is missing required ${chalk.red("package.name")}`,
			);
			return;
		}

		if (!/^[a-z0-9-]+$/.test(typstToml.package.name)) {
			console.info(
				`${chalk.red("[Tyler]")} The package name ${chalk.red(
					typstToml.package.name,
				)} is invalid, it must only contain lowercase letters, numbers, and hyphens, however it contains: ${typstToml.package.name
					.split("")
					.filter((char) => !/^[a-z0-9-]+$/.test(char))
					.map((char) => chalk.red(char))
					.join(", ")}`,
			);
			return;
		}

		console.info(
			`${chalk.greenBright("[Tyler]")} Package name is valid: ${chalk.yellow(
				typstToml.package.name,
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
		// #endregion

		// #region Check package.version
		if (!typstToml.package.version) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.green("typst.toml")} is missing required ${chalk.red("package.version")}`,
			);
			return;
		}

		if (!semver.valid(typstToml.package.version)) {
			console.info(
				`${chalk.red("[Tyler]")} The version of the package is not a valid semver: ${chalk.red(typstToml.package.version)}`,
			);
			return;
		}

		const currentPackageVersion = typstToml.package.version;
		const indexPackageVersion = samePackageName?.version;

		if (
			indexPackageVersion &&
			semver.compare(indexPackageVersion, currentPackageVersion) > 0
		) {
			console.warn(
				`${chalk.red("[Tyler]")} The version of the package ${chalk.green(
					typstToml.package.name,
				)}:${chalk.blue(indexPackageVersion)} on the index is greater than current package ${chalk.green(
					typstToml.package.name,
				)}:${chalk.red(currentPackageVersion)}.`,
			);
		} else if (!indexPackageVersion && currentPackageVersion !== "0.1.0") {
			console.warn(
				`${chalk.red("[Tyler]")} The version of the package ${chalk.green(
					typstToml.package.name,
				)}:${chalk.red(currentPackageVersion)} is not published on the index, but it is not ${chalk.gray("0.1.0")}`,
			);
		} else {
			console.info(
				`${chalk.greenBright("[Tyler]")} Package version is valid: ${chalk.yellow(
					typstToml.package.version,
				)}`,
			);
		}
		// #endregion

		// #region Get source directory
		const sourceDir = !updatedOptions.srcdir
			? path.resolve(workingDirectory, "src")
			: path.isAbsolute(updatedOptions.srcdir)
				? updatedOptions.srcdir
				: path.resolve(workingDirectory, updatedOptions.srcdir);

		// if (!(await fileExists(sourceDir))) {
		// 	throw new Error(
		// 		`[Tyler] Source directory not found: ${chalk.gray(sourceDir)}`,
		// 	);
		// }
		console.info(`[Tyler] Source directory found in ${chalk.gray(sourceDir)}`);
		// #endregion

		// #region Check package.entrypoint
		if (!typstToml.package.entrypoint) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.green("typst.toml")} is missing required ${chalk.red("package.entrypoint")}`,
			);
			return;
		}

		const entrypoint = path.resolve(
			workingDirectory,
			typstToml.package.entrypoint,
		);

		const entrypointInSourceDirectory = path.resolve(
			workingDirectory,
			"src",
			typstToml.package.entrypoint,
		);

		if (await fileExists(entrypointInSourceDirectory)) {
			console.info(
				`${chalk.greenBright("[Tyler]")} Entrypoint ${chalk.yellow(
					typstToml.package.entrypoint,
				)} found in ${chalk.gray(entrypointInSourceDirectory)}`,
			);
		} else if (await fileExists(entrypoint)) {
			console.info(
				`${chalk.greenBright("[Tyler]")} Entrypoint ${chalk.yellow(
					typstToml.package.entrypoint,
				)} found in ${chalk.gray(entrypoint)}`,
			);
		} else {
			console.info(
				`${chalk.red("[Tyler]")} The entrypoint file ${chalk.red(entrypoint)} does not exist`,
			);
			return;
		}
		// #endregion

		// #region Check authors
		if (!typstToml.package.authors) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.green("typst.toml")} is missing required ${chalk.red("package.authors")}`,
			);
			return;
		}

		if (!Array.isArray(typstToml.package.authors)) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.red("package.authors")} must be an array`,
			);
			return;
		}

		for (const author of typstToml.package.authors) {
			if (typeof author !== "string") {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("package.authors")} must be an array of strings`,
				);
				return;
			}

			if (
				!/^[^<]*(?: <(?:[a-zA-Z0-9_\-.]*)?@[^<>]+>|<https?:\/\/[^<>]+>)?$/.test(
					author,
				)
			) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.green("package.authors")} has ${chalk.red(author)} that is invalid, it must be in the format of either "${chalk.gray("Name")}", "${chalk.gray("Name <email@example.com>")}", "${chalk.gray("Name <https://example.com>")}" or "${chalk.gray("Name <@github_handle>")}"`,
				);
				return;
			}
		}

		console.info(
			`${chalk.greenBright("[Tyler]")} Package authors are valid: ${chalk.yellow(
				typstToml.package.authors.join(", "),
			)}`,
		);
		// #endregion

		// #region Check license
		if (!typstToml.package.license) {
			console.info(
				`${chalk.red("[Tyler]")} ${chalk.green("typst.toml")} is missing required ${chalk.red("package.license")}`,
			);
			return;
		}

		// "Must contain a valid SPDX-2 expression describing one or multiple OSI-approved licenses."
		let isValidLicense = false;

		try {
			isValidLicense = spdxExpressionValidate(typstToml.package.license);
		} catch {
			isValidLicense = false;
		}

		if (!isValidLicense) {
			console.info(
				`${chalk.red("[Tyler]")} The license ${chalk.red(
					typstToml.package.license,
				)} is not a valid SPDX-2 expression or OSI approved license`,
			);
			return;
		}

		console.info(
			`${chalk.greenBright("[Tyler]")} Package license is valid: ${chalk.yellow(
				typstToml.package.license,
			)}`,
		);

		const LICENSE_PATH = path.resolve(workingDirectory, "LICENSE");
		if (!(await fileExists(LICENSE_PATH))) {
			console.info(
				`${chalk.red("[Tyler]")} The license file ${chalk.red(LICENSE_PATH)} does not exist`,
			);
		} else {
			console.info(
				`${chalk.greenBright("[Tyler]")} License file found in ${chalk.gray(
					LICENSE_PATH,
				)}`,
			);
		}
		// #endregion

		// #region Check description
		if (typstToml.package.description) {
			console.info(
				`${chalk.greenBright("[Tyler]")} Package description is valid: ${chalk.yellow(
					typstToml.package.description,
				)}`,
			);
		}
		// #endregion

		// #region Check optionals
		if (
			typstToml.package.homepage &&
			validUrl.isUri(typstToml.package.homepage)
		) {
			console.info(
				`${chalk.greenBright("[Tyler]")} Package homepage is valid: ${chalk.yellow(
					typstToml.package.homepage,
				)}`,
			);
		}

		if (
			typstToml.package.repository &&
			validUrl.isUri(typstToml.package.repository)
		) {
			console.info(
				`${chalk.greenBright("[Tyler]")} Package repository is valid: ${chalk.yellow(
					typstToml.package.repository,
				)}`,
			);
		}

		if (typstToml.package.keywords) {
			if (!Array.isArray(typstToml.package.keywords)) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("package.keywords")} must be an array`,
				);
				return;
			}

			const allExistingKeywords = new Set(
				versionIndex.flatMap((pkg) => pkg.keywords ?? []),
			);

			for (const keyword of typstToml.package.keywords) {
				if (!allExistingKeywords.has(keyword)) {
					console.info(
						`${chalk.red("[Tyler]")} The keyword ${chalk.red(keyword)} is not in the index already, are you sure you want to add it?`,
					);
				}
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Package keywords are valid: ${chalk.yellow(
					typstToml.package.keywords.join(", "),
				)}`,
			);
		}

		if (typstToml.package.categories) {
			if (!Array.isArray(typstToml.package.categories)) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("package.categories")} must be an array`,
				);
				return;
			}

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

			for (const category of typstToml.package.categories) {
				if (!VALID_CATEGORIES.includes(category)) {
					console.info(
						`${chalk.red("[Tyler]")} The category ${chalk.red(category)} is not valid`,
					);
				}
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Package categories are valid: ${chalk.yellow(
					typstToml.package.categories.join(", "),
				)}`,
			);
		}

		if (typstToml.package.disciplines) {
			if (!Array.isArray(typstToml.package.disciplines)) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("package.disciplines")} must be an array`,
				);
			}

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

			for (const discipline of typstToml.package.disciplines) {
				if (!VALID_DISCIPLINES.includes(discipline)) {
					console.info(
						`${chalk.red("[Tyler]")} The discipline ${chalk.red(discipline)} is not valid`,
					);
				}
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Package disciplines are valid: ${chalk.yellow(
					typstToml.package.disciplines.join(", "),
				)}`,
			);
		}

		if (typstToml.package.compiler) {
			if (!semver.valid(typstToml.package.compiler)) {
				console.info(
					`${chalk.red("[Tyler]")} The compiler version ${chalk.red(
						typstToml.package.compiler,
					)} is not a valid semver`,
				);
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Package compiler is valid: ${chalk.yellow(
					typstToml.package.compiler,
				)}`,
			);
		}

		if (typstToml.package.exclude) {
			if (!Array.isArray(typstToml.package.exclude)) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("package.exclude")} must be an array`,
				);
			}

			let found = false;
			const allFiles = await fs.readdir(workingDirectory, { recursive: true });
			const globChars = ["*", "?", "[", "]", "{", "}"];
			for (const exclude of typstToml.package.exclude) {
				if (globChars.some((char) => exclude.includes(char))) {
					const hasMatch = allFiles.some((file) => minimatch(file, exclude));
					if (!hasMatch) {
						console.info(
							`${chalk.red("[Tyler]")} The exclude pattern ${chalk.red(exclude)} does not match any files`,
						);
						found = true;
					}
					continue;
				}

				if (!(await fileExists(path.resolve(workingDirectory, exclude)))) {
					console.info(
						`${chalk.red("[Tyler]")} The file ${chalk.red(exclude)} does not exist`,
					);
					found = true;
				}
			}

			if (!found) {
				console.info(
					`${chalk.greenBright("[Tyler]")} Package exclude is valid: ${chalk.yellow(
						typstToml.package.exclude.join(", "),
					)}`,
				);
			}
		}
		// #endregion

		// #region Check template
		if (typstToml.template) {
			console.info("[Tyler] Package is template");

			if (!typstToml.template.path) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("template.path")} is required`,
				);
				return;
			}

			if (
				!(await fileExists(
					path.resolve(workingDirectory, typstToml.template.path),
				)) &&
				!(await fileExists(path.resolve(sourceDir, typstToml.template.path)))
			) {
				console.info(
					`${chalk.red("[Tyler]")} The template path ${chalk.red(typstToml.template.path)} does not exist`,
				);
				return;
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Template path is valid: ${chalk.yellow(
					typstToml.template.path,
				)}`,
			);

			if (!typstToml.template.entrypoint) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("template.entrypoint")} is required`,
				);
				return;
			}

			if (
				!(await fileExists(
					path.resolve(
						workingDirectory,
						typstToml.template.path,
						typstToml.template.entrypoint,
					),
				)) &&
				!(await fileExists(
					path.resolve(
						sourceDir,
						typstToml.template.path,
						typstToml.template.entrypoint,
					),
				))
			) {
				console.info(
					`${chalk.red("[Tyler]")} The entrypoint ${chalk.red(
						typstToml.template.entrypoint,
					)} does not exist`,
				);
				return;
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Template entrypoint is valid: ${chalk.yellow(
					typstToml.template.entrypoint,
				)}`,
			);

			if (!typstToml.template.thumbnail) {
				console.info(
					`${chalk.red("[Tyler]")} ${chalk.red("template.thumbnail")} is required`,
				);
				return;
			}

			if (
				!(await fileExists(
					path.resolve(workingDirectory, typstToml.template.thumbnail),
				))
			) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail file ${chalk.red(
						typstToml.template.thumbnail,
					)} does not exist`,
				);
				return;
			}

			if (
				!["png", "webp"].includes(
					path.extname(typstToml.template.thumbnail).slice(1),
				)
			) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail ${chalk.red(
						typstToml.template.thumbnail,
					)} is not a valid image`,
				);
				return;
			}

			const thumbnailType = await imageType(
				await fs.readFile(
					path.resolve(workingDirectory, typstToml.template.thumbnail),
				),
			);

			if (
				!thumbnailType ||
				!["image/png", "image/webp"].includes(thumbnailType.mime)
			) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail ${chalk.red(
						typstToml.template.thumbnail,
					)} is not a valid image`,
				);
				return;
			}

			const thumbnailDimensions = imageSize(
				path.resolve(workingDirectory, typstToml.template.thumbnail),
			);
			const MIN_THUMBNAIL_SIZE = 1080;
			if (!thumbnailDimensions.width || !thumbnailDimensions.height) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail ${chalk.red(
						typstToml.template.thumbnail,
					)} does not have valid dimensions`,
				);
				return;
			}

			if (
				Math.max(thumbnailDimensions.width, thumbnailDimensions.height) <
				MIN_THUMBNAIL_SIZE
			) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail ${chalk.red(
						typstToml.template.thumbnail,
					)} is too small, it must be at least ${MIN_THUMBNAIL_SIZE}px on the longest side`,
				);
			}

			const thumbnailFilesize = (
				await fs.stat(
					path.resolve(workingDirectory, typstToml.template.thumbnail),
				)
			).size;

			// "Its file size must not exceed 3MB."
			const MAX_THUMBNAIL_SIZE = 1024 * 1024 * 3;

			if (thumbnailFilesize > MAX_THUMBNAIL_SIZE) {
				console.info(
					`${chalk.red("[Tyler]")} The thumbnail ${chalk.red(
						typstToml.template.thumbnail,
					)} is too large, it must be less than ${MAX_THUMBNAIL_SIZE} bytes`,
				);
			}

			console.info(
				`${chalk.greenBright("[Tyler]")} Template thumbnail is valid: ${chalk.yellow(
					typstToml.template.thumbnail,
				)} (${thumbnailFilesize} bytes < ${MAX_THUMBNAIL_SIZE} bytes, ${thumbnailDimensions.width}x${thumbnailDimensions.height}) >= ${MIN_THUMBNAIL_SIZE}px`,
			);
		}
		// #endregion

		// #region Get entrypoint
		// const entrypoint = typstToml.package.entrypoint ?? "lib.typ";
		// // TODO: Check if the entrypoint is valid
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
	install: boolean | undefined;
	publish: boolean | undefined;
}>;
