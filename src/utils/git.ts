import semver from "semver";
import { execAndGetOutput, execAndRedirect } from "@/utils/process";

export async function isValidGitRepository(
	gitRepoDir: string,
): Promise<boolean> {
	// git rev-parse --is-inside-work-tree
	try {
		await execAndRedirect(
			`git -C ${gitRepoDir} rev-parse --is-inside-work-tree`,
		);
		return true;
	} catch {
		return false;
	}
}

export async function getGitVersion(): Promise<string | null> {
	try {
		const output = await execAndGetOutput("git --version");
		// Output format: "git version 2.25.1" (may vary slightly by OS but usually contains the version)
		const match = output.match(/git version (\d+\.\d+\.\d+)/);
		if (match?.[1]) {
			return match[1];
		}
		return null;
	} catch {
		return null;
	}
}

export async function checkGitVersion(minVersion: string): Promise<boolean> {
	const version = await getGitVersion();
	if (!version) {
		return false;
	}
	return semver.gte(version, minVersion);
}
