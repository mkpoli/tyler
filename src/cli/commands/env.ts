import { spawnSync } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import commandExists from "command-exists";
import { fileExists, getDataDirectory } from "@/utils/file";
import type { Command } from "./types";

export default {
	name: "env",
	description:
		"Show environment information (Typst executable path in current environment and local package directory)",
	options: [],
	usage: "",
	async run() {
		// 1. Typst executable
		console.info(chalk.bold("Typst Executable:"));
		try {
			const isTypstInstalled = await commandExists("typst");
			if (!isTypstInstalled) {
				console.info(`  ${chalk.red("Not found")}`);
			} else {
				const whichCmd = process.platform === "win32" ? "where" : "which";
				const result = spawnSync(whichCmd, ["typst"], { encoding: "utf-8" });
				let typstPath = "";
				if (result.stdout) {
					typstPath = result.stdout.trim().split("\n")[0].trim();
					console.info(`  Path: ${typstPath}`);
				} else {
					console.info(`  Path: ${chalk.yellow("Found, but path unknown")}`);
				}

				if (typstPath) {
					const versionResult = spawnSync(typstPath, ["--version"], {
						encoding: "utf-8",
					});
					if (versionResult.stdout) {
						console.info(`  Version: ${versionResult.stdout.trim()}`);
					}
				}
			}
		} catch (error) {
			console.info(`  ${chalk.red("Error checking typst: ")}${error}`);
		}
		console.info("");

		// 2. Local package directory
		const dataDir = await getDataDirectory();
		const localPackagesDir = path.join(dataDir, "typst", "packages", "local");

		console.info(chalk.bold("Local Package Directory:"));
		console.info(`  Path: ${localPackagesDir}`);

		const isLocalPackagesDirExists = await fileExists(localPackagesDir);
		if (isLocalPackagesDirExists) {
			console.info(`  Status: ${chalk.green("Exists")}`);
		} else {
			console.info(`  Status: ${chalk.red("Not found")}`);
		}
	},
} satisfies Command;
