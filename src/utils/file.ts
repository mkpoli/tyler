import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function getWorkingDirectory(
	entrypoint: string | undefined,
): Promise<string> {
	if (entrypoint === undefined) return process.cwd();

	const resolved = path.resolve(entrypoint);

	if (!(await fileExists(resolved))) {
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

export async function getDataDirectory(): Promise<string> {
	const system = os.platform();
	switch (system) {
		case "linux":
			return os.homedir() + "/.local/share";
		case "darwin":
			return os.homedir() + "/Library/Application Support";
		case "win32":
			return os.homedir() + "%APPDATA%";
		default:
			throw new Error(`Unsupported platform: ${system}`);
	}
}
