import { execAndRedirect } from "@/utils/process";

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
