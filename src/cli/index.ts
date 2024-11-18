import chalk from "chalk";
import cla from "command-line-args";
import commands from "./commands";
import type { Command } from "./commands/types";
import { commandsOnly, help } from "./help";

export async function main(): Promise<void> {
	const options = cla(commands.root.options, {
		stopAtFirstUnknown: true,
	}) as {
		command: string | undefined;
		help: boolean;
		version: boolean;
		_unknown: string[];
	};
	const argv = options._unknown || [];

	if (options.version) {
		console.log(process.env.npm_package_version);
		return;
	}

	if (options.command === undefined) {
		help(commands.root);
		return;
	}

	if (!(options.command in commands)) {
		console.error(`Command ${chalk.bold(options.command)} not found`);
		commandsOnly();
		return;
	}

	const command: Command = commands[options.command as keyof typeof commands];
	if (options.help) {
		help(command);
	} else {
		const options = cla(command.options, {
			argv,
			camelCase: true,
		});
		try {
			await command.run(options);
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}
}
