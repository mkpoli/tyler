import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";

import { fileExists } from "@/utils/file";
import { execAndRedirect, isCommandInstalled } from "@/utils/process";
import { isValidGitRepository } from "@/utils/git";
import inquirer from "inquirer";

export const TYPST_PACKAGES_REPO_URL = "https://github.com/typst/packages.git";
export async function cloneOrCleanRepo(
	dir: string,
	dryRun: boolean,
	builtPackageName: string,
	builtPackageVersion: string,
): Promise<string> {
	if (!(await isCommandInstalled("git"))) {
		throw new Error("[Tyler] Git is not installed, cannot proceed");
	}

	const gitRepoDir = path.join(dir, "packages");

	if (!(await fileExists(gitRepoDir))) {
		const isGitRepo = await isValidGitRepository(gitRepoDir);
		if (!isGitRepo) {
			console.info(
				`[Tyler] ${chalk.gray(gitRepoDir)} is not a valid git repository, can we remove it?`,
			);

			const { remove }: { remove: boolean } = await inquirer.prompt([
				{
					type: "confirm",
					name: "remove",
					message: "Remove the directory?",
				},
			]);

			if (remove) {
				// - Remove the directory
				if (dryRun) {
					console.info(
						`[Tyler] ${chalk.gray("(dry-run)")} Would remove ${chalk.gray(gitRepoDir)}`,
					);
				} else {
					await fs.rm(gitRepoDir, { recursive: true });
					console.info(`[Tyler] Removed ${chalk.gray(gitRepoDir)}`);
				}
			} else {
				throw new Error(
					`[Tyler] ${chalk.gray(gitRepoDir)} is not a valid git repository, and we cannot remove it`,
				);
			}
		}

		const cloneCommand = `git clone ${TYPST_PACKAGES_REPO_URL} ${gitRepoDir} --depth 1`;

		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would clone ${chalk.gray(TYPST_PACKAGES_REPO_URL)} into ${chalk.gray(gitRepoDir)}`,
			);
		} else {
			try {
				await execAndRedirect(cloneCommand);
				console.info(
					`[Tyler] Cloned ${chalk.gray(TYPST_PACKAGES_REPO_URL)} into ${chalk.gray(gitRepoDir)}`,
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
		if (dryRun) {
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

	return gitRepoDir;
}
