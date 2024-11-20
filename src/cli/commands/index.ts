import build from "./build";
import check from "./check";
import type { Command } from "./types";

const help = {
	name: "help",
	type: Boolean,
	alias: "h",
	description: "Display help (this message)",
};

const version = {
	name: "version",
	type: Boolean,
	alias: "v",
	description: "Display version",
};

const root: Command = {
	name: undefined,
	description: "Root command",
	options: [
		{
			name: "command",
			type: String,
			defaultOption: true,
			description: "The command to run",
			hide: true,
		},
		help,
		version,
	],
	run: async () => {},
	usage: "<command> [options]",
} satisfies Command;

const commands = {
	build,
	check,
};

const injected = Object.fromEntries(
	Object.entries(commands).map(([key, command]) => [
		key,
		{
			...command,
			options: [...command.options],
		},
	]),
);

export default { root, ...injected } satisfies Record<string, Command>;
