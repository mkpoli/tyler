import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";

import { fileExists } from "@/utils/file";
import { isValidGitRepository } from "@/utils/git";
import { exec, execAndRedirect, isCommandInstalled } from "@/utils/process";
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
		// #region Remove untracked files
		const removeUntrackedCommand = `git -C ${gitRepoDir} clean -fd`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would remove untracked files in ${chalk.gray(gitRepoDir)} by ${chalk.gray(removeUntrackedCommand)}`,
			);
		} else {
			await execAndRedirect(removeUntrackedCommand);
			console.info(
				`[Tyler] Removed untracked files in ${chalk.gray(gitRepoDir)} by ${chalk.gray(removeUntrackedCommand)}`,
			);
		}
		// #endregion

		// #region Checkout to origin/main
		const checkoutCommand = `git -C ${gitRepoDir} checkout origin/main`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would checkout to origin/main in ${chalk.gray(gitRepoDir)} by ${chalk.gray(checkoutCommand)}`,
			);
		} else {
			await exec(checkoutCommand);
			console.info(
				`[Tyler] Checked out to origin/main in ${chalk.gray(gitRepoDir)} by ${chalk.gray(checkoutCommand)}`,
			);
		}
		// #endregion

		// #region Reset origin url
		const originExistsCommand = `git -C ${gitRepoDir} remote get-url origin`;
		const setOriginCommand = `git -C ${gitRepoDir} remote set-url origin ${TYPST_PACKAGES_REPO_URL}`;
		const addOriginCommand = `git -C ${gitRepoDir} remote add origin ${TYPST_PACKAGES_REPO_URL}`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would reset origin url in ${chalk.gray(gitRepoDir)}`,
			);
		} else {
			try {
				await execAndRedirect(originExistsCommand);
				await execAndRedirect(setOriginCommand);
				console.info(
					`[Tyler] Reset origin url in ${chalk.gray(gitRepoDir)} by ${chalk.gray(setOriginCommand)}`,
				);
			} catch {
				await execAndRedirect(addOriginCommand);
				console.info(
					`[Tyler] Added origin url in ${chalk.gray(gitRepoDir)} by ${chalk.gray(addOriginCommand)}`,
				);
			}
		}
		// #endregion

		// #region Clean up git working tree
		const cleanCommand = `git -C ${gitRepoDir} reset --hard origin/main`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would clean up git working tree in ${chalk.gray(gitRepoDir)} by ${chalk.gray(cleanCommand)}`,
			);
		} else {
			await execAndRedirect(cleanCommand);
			console.info(
				`[Tyler] Cleaned up git working tree in ${chalk.gray(gitRepoDir)} by ${chalk.gray(cleanCommand)}`,
			);
		}
		// #endregion

		// #region Fetch the latest changes from origin
		const fetchCommand = `git -C ${gitRepoDir} fetch origin`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would fetch latest changes from origin in ${chalk.gray(gitRepoDir)} by ${chalk.gray(fetchCommand)}`,
			);
		} else {
			await execAndRedirect(fetchCommand);
			console.info(
				`[Tyler] Fetched latest changes from origin in ${chalk.gray(gitRepoDir)} by ${chalk.gray(fetchCommand)}`,
			);
		}
		// #endregion

		// #region Delete branch if it exists
		const targetBranchName = `${builtPackageName}-${builtPackageVersion}`;
		const deleteBranchCommand = `git -C ${gitRepoDir} branch -D ${targetBranchName}`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would delete branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(deleteBranchCommand)}`,
			);
		} else {
			await exec(deleteBranchCommand);
			console.info(
				`[Tyler] Deleted branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(deleteBranchCommand)}`,
			);
		}
		// #endregion

		// #region Create a new branch from origin/main
		const createBranchCommand = `git -C ${gitRepoDir} checkout -b ${targetBranchName} HEAD`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would create a new branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(createBranchCommand)}`,
			);
		} else {
			await exec(createBranchCommand);
			console.info(
				`[Tyler] Created a new branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(createBranchCommand)}`,
			);
		}
		// #endregion
	}

	return gitRepoDir;
}
