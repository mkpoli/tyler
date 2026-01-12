import fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";
import inquirer from "inquirer";
import { fileExists } from "@/utils/file";
import { isValidGitRepository } from "@/utils/git";
import { exec, execAndRedirect, isCommandInstalled } from "@/utils/process";

export const TYPST_PACKAGES_REPO_URL = "https://github.com/typst/packages.git";
export interface ExistingPr {
	url: string;
	number: number;
	headRefName: string;
	headRepository: {
		url: string;
		name: string;
	};
	headRepositoryOwner: {
		login: string;
	};
}

export async function cloneOrCleanRepo(
	dir: string,
	dryRun: boolean,
	builtPackageName: string,
	builtPackageVersion: string,
	existingPr?: ExistingPr,
): Promise<string> {
	if (!(await isCommandInstalled("git"))) {
		throw new Error("[Tyler] Git is not installed, cannot proceed");
	}

	const gitRepoDir = path.join(dir, "packages");

	// Check if the directory exists
	if (await fileExists(gitRepoDir)) {
		// Check if it is a valid git repository
		if (await isValidGitRepository(gitRepoDir)) {
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
		} else {
			// Directory exists but is not a valid git repository
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
					await fs.rm(gitRepoDir, { recursive: true, force: true });
					console.info(`[Tyler] Removed ${chalk.gray(gitRepoDir)}`);
				}
			} else {
				throw new Error(
					`[Tyler] ${chalk.gray(gitRepoDir)} is not a valid git repository, and we cannot remove it`,
				);
			}
		}
	}

	// If the directory does not exist (or was removed), clone the repository
	if (!(await fileExists(gitRepoDir))) {
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
	}

	if (existingPr) {
		// #region Setup Existing PR
		if (!existingPr.headRepository || !existingPr.headRepositoryOwner) {
			console.warn(
				`[Tyler] ${chalk.red("Error:")} Existing PR object is missing headRepository or headRepositoryOwner information.`,
			);
			console.warn(
				`[Tyler] Existing PR object: ${JSON.stringify(existingPr, null, 2)}`,
			);
			throw new Error(
				`[Tyler] Existing PR object is missing headRepository or headRepositoryOwner information.`,
			);
		}

		const remoteName = existingPr.headRepositoryOwner.login;
		let remoteUrl = existingPr.headRepository.url;
		if (!remoteUrl) {
			remoteUrl = `https://github.com/${existingPr.headRepositoryOwner.login}/${existingPr.headRepository.name}.git`;
		}
		const branchName = existingPr.headRefName;

		// Add remote
		const addRemoteCommand = `git -C ${gitRepoDir} remote add ${remoteName} ${remoteUrl}`;
		const setRemoteCommand = `git -C ${gitRepoDir} remote set-url ${remoteName} ${remoteUrl}`;

		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would add/set remote ${chalk.gray(remoteName)} to ${chalk.gray(remoteUrl)}`,
			);
		} else {
			try {
				await execAndRedirect(
					`git -C ${gitRepoDir} remote get-url ${remoteName}`,
				);
				await execAndRedirect(setRemoteCommand);
			} catch {
				await execAndRedirect(addRemoteCommand);
			}
			console.info(
				`[Tyler] Set remote ${chalk.gray(remoteName)} to ${chalk.gray(remoteUrl)}`,
			);
		}

		// Fetch branch
		// Fetch remote
		const fetchRemoteCommand = `git -C ${gitRepoDir} fetch ${remoteName}`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would fetch remote ${chalk.gray(remoteName)}`,
			);
		} else {
			await execAndRedirect(fetchRemoteCommand);
			console.info(`[Tyler] Fetched remote ${chalk.gray(remoteName)}`);
		}

		// Checkout branch from remote
		const checkoutBranchCommand = `git -C ${gitRepoDir} checkout -B ${branchName} ${remoteName}/${branchName}`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would checkout to ${chalk.gray(branchName)} tracking ${chalk.gray(`${remoteName}/${branchName}`)}`,
			);
		} else {
			await execAndRedirect(checkoutBranchCommand);
			console.info(`[Tyler] Checked out to ${chalk.gray(branchName)}`);
		}

		// #endregion
	} else {
		// #region Delete branch if it exists
		const targetBranchName = `${builtPackageName}-${builtPackageVersion}`;
		const deleteBranchCommand = `git -C ${gitRepoDir} branch -D ${targetBranchName}`;
		if (dryRun) {
			console.info(
				`[Tyler] ${chalk.gray("(dry-run)")} Would delete branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(deleteBranchCommand)}`,
			);
		} else {
			try {
				await exec(deleteBranchCommand);
				console.info(
					`[Tyler] Deleted branch ${chalk.gray(targetBranchName)} in ${chalk.gray(gitRepoDir)} by ${chalk.gray(deleteBranchCommand)}`,
				);
			} catch {
				// Ignore error
			}
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

export async function interactivePullRequest(
	gitRepoDir: string,
	builtPackageName: string,
	builtPackageVersion: string,
	isNewPackage: boolean,
	isTemplate: boolean,
	dryRun: boolean,
): Promise<string> {
	console.info(
		`[Tyler] Interactive PR for ${chalk.cyan(builtPackageName)}:${chalk.cyan(
			builtPackageVersion,
		)}`,
	);
	const { action }: { action: "now" | "later" } = await inquirer.prompt([
		{
			type: "list",
			name: "action",
			message: "How do you want to provide the PR details?",
			choices: [
				{
					name: "Fill interactively now",
					value: "now",
				},
				{
					name: "Fill on GitHub later",
					value: "later",
				},
			],
		},
	]);

	if (action === "later") {
		return ".github/pull_request_template.md";
	}

	console.info("[Tyler] Please fill in the details for the pull request:");

	const { description }: { description: string } = await inquirer.prompt([
		{
			type: "input",
			name: "description",
			message: "Description (what the package does and why it is useful):",
		},
	]);

	const { checklist }: { checklist: string[] } = await inquirer.prompt([
		{
			type: "checkbox",
			name: "checklist",
			message: "Checklist (Space to select, Enter to confirm):",
			choices: [
				{
					name: "Selected a name that isn't the most obvious or canonical name for what the package does",
					value: "name",
					checked: true,
				},
				{
					name: "Added a typst.toml file with all required keys",
					value: "toml",
					checked: true,
				},
				{
					name: "Added a README.md with documentation for my package",
					value: "readme",
					checked: true,
				},
				{
					name: "Chosen a license and added a LICENSE file or linked one in my README.md",
					value: "license",
					checked: true,
				},
				{
					name: "Tested my package locally on my system and it worked",
					value: "test",
					checked: true,
				},
				{
					name: "Excluded PDFs or README images, if any, but not the LICENSE",
					value: "exclude",
					checked: true,
				},
				...(isTemplate
					? [
							{
								name: "Ensured that my package is licensed such that users can use and distribute the contents of its template directory without restriction, after modifying them through normal use.",
								value: "template_license",
								checked: true,
							},
						]
					: []),
			],
		},
	]);

	const prBody = `<!--
Thanks for submitting a package! Please read and follow the submission guidelines detailed in the repository's README and check the boxes below. Please name your PR as \`name:version\` of the submitted package.

If you want to make a PR for something other than a package submission, just delete all this and make a plain PR.
-->

I am submitting
- [${isNewPackage ? "x" : " "}] a new package
- [${!isNewPackage ? "x" : " "}] an update for a package

<!--
Please add a brief description of your package below and explain why you think it is useful to others. If this is an update, please briefly say what changed.
-->

${description}

<!--
These things need to be checked for a new submission to be merged. If you're just submitting an update, you can delete the following section.
-->

I have read and followed the submission guidelines and, in particular, I
- [${checklist.includes("name") ? "x" : " "}] selected [a name](https://github.com/typst/packages/blob/main/docs/manifest.md#naming-rules) that isn't the most obvious or canonical name for what the package does
- [${checklist.includes("toml") ? "x" : " "}] added a [\`typst.toml\`](https://github.com/typst/packages/blob/main/docs/manifest.md#package-metadata) file with all required keys
- [${checklist.includes("readme") ? "x" : " "}] added a [\`README.md\`](https://github.com/typst/packages/blob/main/docs/documentation.md) with documentation for my package
- [${checklist.includes("license") ? "x" : " "}] have chosen [a license](https://github.com/typst/packages/blob/main/docs/licensing.md) and added a \`LICENSE\` file or linked one in my \`README.md\`
- [${checklist.includes("test") ? "x" : " "}] tested my package locally on my system and it worked
- [${checklist.includes("exclude") ? "x" : " "}] [\`exclude\`d](https://github.com/typst/packages/blob/main/docs/tips.md#what-to-commit-what-to-exclude) PDFs or README images, if any, but not the LICENSE

<!--
The following box only needs to be checked for **template** submissions. If you're submitting a package that isn't a template, you can delete the following section. See the guidelines section about licenses in the README for more details.
-->
${
	isTemplate
		? `- [${checklist.includes("template_license") ? "x" : " "}] ensured that my package is licensed such that users can use and distribute the contents of its template directory without restriction, after modifying them through normal use.`
		: ""
}
`;

	const prBodyFileName = "tyler-pr-body.md";
	const prBodyPath = path.join(gitRepoDir, prBodyFileName);

	if (dryRun) {
		console.info(
			`[Tyler] ${chalk.gray("(dry-run)")} Would write PR body to ${chalk.gray(prBodyPath)}`,
		);
		console.info(`[Tyler] ${chalk.gray("(dry-run)")} PR Body:\n${prBody}`);
	} else {
		await fs.writeFile(prBodyPath, prBody);
		console.info(`[Tyler] Written PR body to ${chalk.gray(prBodyPath)}`);
	}

	return prBodyFileName;
}
