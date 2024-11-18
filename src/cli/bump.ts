import chalk from "chalk";
import inquirer from "inquirer";
import semver from "semver";

export function bumpVersion(
	version: string,
	bump: "skip" | "patch" | "minor" | "major" | string,
): string {
	if (bump === "skip") {
		return version;
	}

	if (["patch", "minor", "major"].includes(bump)) {
		const bumpedVersion = semver.inc(
			version,
			bump as "patch" | "minor" | "major",
		);
		if (!bumpedVersion) {
			throw new Error("[Tyler] Failed to bump the version");
		}
		return bumpedVersion;
	}

	if (semver.valid(bump)) {
		return bump;
	}

	throw new Error("[Tyler] Failed to bump the version");
}

export async function interactivelyBumpVersion(
	version: string,
): Promise<string> {
	const bumpMode:
		| {
				type: "custom";
				version: string;
		  }
		| {
				type: "patch" | "minor" | "major" | "skip" | "cancel";
				version: null;
		  } = await inquirer.prompt([
		{
			type: "list",
			name: "type",
			message: `current version: ${chalk.bold(chalk.yellow(version))}        ->`,
			choices: [
				{
					name: `${"patch".padStart(16)} ${chalk.bold(semver.inc(version, "patch"))}`,
					value: "patch",
				},
				{
					name: `${"minor".padStart(16)} ${chalk.bold(semver.inc(version, "minor"))}`,
					value: "minor",
				},
				{
					name: `${"major".padStart(16)} ${chalk.bold(semver.inc(version, "major"))}`,
					value: "major",
				},
				{
					name: `${"as-is".padStart(16)} ${chalk.bold(version)}`,
					value: "skip",
				},
				{
					name: `${"custom".padStart(17)}`,
					value: "custom",
				},
				{
					name: `${"cancel".padStart(17)}`,
					value: "cancel",
				},
			],
		},
		{
			type: "input",
			name: "version",
			message: "Enter the version to bump to",
			when: (answers) => answers.type === "custom",
		},
	]);

	if (bumpMode.type === "custom") {
		if (!semver.valid(bumpMode.version)) {
			console.error("[Tyler] The version is not a valid semver");
			process.exit(1);
		}

		console.info(`[Tyler] Bumping version to ${chalk.bold(bumpMode.version)}`);
		return bumpVersion(version, bumpMode.version);
	}

	if (bumpMode.type === "cancel") {
		console.info("[Tyler] Cancelled by user");
		process.exit(0);
	}

	const targetVersion = bumpVersion(version, bumpMode.type);
	console.info(
		`[Tyler] Bumping version by ${chalk.bold(bumpMode.type)} to ${chalk.bold(targetVersion)}...`,
	);

	return targetVersion;
}
