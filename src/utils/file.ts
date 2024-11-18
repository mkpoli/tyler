import fs from "node:fs/promises";
import path from "node:path";

export async function getWorkingDirectory(
	entrypoint: string | undefined,
): Promise<string> {
	if (entrypoint === undefined) return process.cwd();

	const resolved = path.resolve(entrypoint);

	if (!(await fs.exists(resolved))) {
		throw new Error(`Entrypoint ${entrypoint} does not exist`);
	}

	if (!(await fs.lstat(resolved)).isDirectory()) {
		return path.dirname(resolved);
	}

	return resolved;
}

export async function clearDirectoryWithoutDeletingIt(
	dir: string,
): Promise<void> {
	for (const file of await fs.readdir(dir)) {
		await fs.rm(path.resolve(dir, file), { recursive: true, force: true });
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}
