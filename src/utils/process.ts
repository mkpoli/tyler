import { spawn } from "node:child_process";

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
