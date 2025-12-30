import { spawn } from "node:child_process";
import commandExists from "command-exists";

export async function execAndRedirect(command: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const [cmd, ...args] = command.split(" ");
		const child = spawn(cmd, args, {
			stdio: "inherit",
		});
		// child.stdout?.pipe(process.stdout);
		child.stdout?.on("data", (data) => {
			console.log(data.toString());
		});
		child.on("error", (error) => {
			reject(error);
		});
		child.on("exit", () => {
			resolve();
		});
	});
}

export async function exec(command: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const [cmd, ...args] = command.split(" ");
		const child = spawn(cmd, args, {
			stdio: "ignore",
		});
		child.on("error", (error) => {
			reject(error);
		});
		child.on("exit", () => {
			resolve();
		});
	});
}

export async function isCommandInstalled(command: string): Promise<boolean> {
	try {
		await commandExists(command);
		return true;
	} catch {
		return false;
	}
}

export async function execAndGetOutput(command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const [cmd, ...args] = command.split(" ");
		const child = spawn(cmd, args, {
			stdio: ["ignore", "pipe", "ignore"],
		});
		let output = "";
		child.stdout.on("data", (data) => {
			output += data.toString();
		});
		child.on("error", (error) => {
			reject(error);
		});
		child.on("exit", (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`Command ${command} failed with code ${code}`));
			}
		});
	});
}
