import semver from "semver";
import { execAndGetOutput, execAndRedirect } from "@/utils/process";

export interface GitContributor {
	name: string;
	email: string;
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

function contributorKey(contributor: GitContributor): string {
	return contributor.email.trim().toLowerCase();
}

function addContributor(
	contributors: Map<string, GitContributor>,
	name: string,
	email: string,
): void {
	const contributor = { name: name.trim(), email: email.trim() };
	if (!contributor.name || !contributor.email) {
		return;
	}
	if (!contributors.has(contributorKey(contributor))) {
		contributors.set(contributorKey(contributor), contributor);
	}
}

export function formatCoAuthoredBy(contributor: GitContributor): string {
	return `Co-authored-by: ${contributor.name} <${contributor.email}>`;
}

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

export async function getGitAuthor(
	gitRepoDir: string,
): Promise<GitContributor | null> {
	try {
		const output = await execAndGetOutput(
			`git -C ${shellQuote(gitRepoDir)} var GIT_AUTHOR_IDENT`,
		);
		const match = output.match(/^(.*) <([^<>]+)> \d+ [+-]\d+\s*$/);
		if (!match?.[1] || !match[2]) {
			return null;
		}
		return { name: match[1].trim(), email: match[2].trim() };
	} catch {
		return null;
	}
}

export async function getGitContributors(
	gitRepoDir: string,
): Promise<GitContributor[]> {
	try {
		const log = await execAndGetOutput(
			`git -C ${shellQuote(gitRepoDir)} log --format='%aN%x00%aE%x00%B%x00%x1e'`,
		);
		const contributors = new Map<string, GitContributor>();
		for (const commit of log.split("\x1e")) {
			const [authorName, authorEmail, ...messageParts] = commit.split("\x00");
			addContributor(contributors, authorName ?? "", authorEmail ?? "");

			const message = messageParts.join("\x00");
			for (const match of message.matchAll(
				/^Co-authored-by:\s*(.*?)\s*<([^<>]+)>\s*$/gim,
			)) {
				addContributor(contributors, match[1] ?? "", match[2] ?? "");
			}
		}
		return [...contributors.values()];
	} catch {
		return [];
	}
}

export function excludeContributor(
	contributors: GitContributor[],
	excluded: GitContributor | null,
): GitContributor[] {
	if (!excluded) {
		return contributors;
	}
	const excludedKey = contributorKey(excluded);
	return contributors.filter(
		(contributor) => contributorKey(contributor) !== excludedKey,
	);
}
