import commands from "@/cli/commands";
import type { Command } from "@/cli/commands/types";
import { version } from "@/utils/version";
import chalk from "chalk";
import clu from "command-line-usage";

const LOGO = `
        .               oooo                     
      .o8               \`888                     
    .o888oo oooo    ooo  888   .ooooo.v oooo d8b 
      888    \`88.  .8'   888  d88' \`88b \`888\"\"8P 
      888     \`88..8'    888  888ooo888  888     
      888 .    \`888'     888  888    .o  888     
      "888"     .8'     o888o \`Y8bod8P' d888b    
            .o..P'                               
            \`Y8P'                                
`;

export function help(command: Command): void {
	const sections: clu.Section[] = [];

	if (command.name === undefined) {
		sections.push({
			header: `Tyler v${version}`,
			content:
				"Typst package compiler for the ease of packaging and publishing Typst packages and templates.",
		});
		sections.push({
			content: chalk.blueBright(LOGO),
			raw: true,
		});
	} else {
		sections.push({
			header: `Tyler v${version}`,
		});
	}

	sections.push({
		header: "Usage",
		content: `${chalk.cyan("$")} ${chalk.bold("tyler")} ${command.name ? `${chalk.green(command.name)} ` : ""}${chalk.green(
			command.usage,
		)}`,
	});

	const parameters = command.options.find((p) => p.defaultOption);
	if (parameters) {
		sections.push({
			header: "Parameters",
			content: generateParametersSection(command),
		});
	}

	if (command.name === undefined) {
		sections.push({
			header: "Commands",
			content: generateCommandsSection(commands),
		});
	}

	sections.push({
		header: "Options",
		optionList: command.options.filter((p) => !p.hide),
	});

	const usage = clu(sections);
	console.log(usage);
}

function generateCommandsSection(commands: Record<string, Command>): string {
	const commandList = Object.keys(commands)
		.filter((command) => command !== "root")
		.map((command) => {
			return `       ${chalk.green(command)}    ${commands[command].description}`;
		});

	const commandUsage = commandList.join("\n");
	const commandHelp = `To see more about a command, run: ${chalk.bold("tyler")} ${chalk.green("<command>")} ${chalk.cyan("--help")}, for example:\n\n\t${chalk.cyan("$")} ${chalk.bold("tyler")} ${chalk.green("build")} ${chalk.cyan("--help")}`;

	return `${commandUsage}\n\n${commandHelp}`;
}

function generateParametersSection(command: Command): string {
	const parameters = command.options.find((p) => p.defaultOption);
	if (parameters) {
		return `\t${chalk.cyan("<")}${parameters.name}${chalk.cyan(">")} ${parameters.description}`;
	}
	return "";
}

export function commandsOnly(): void {
	console.log(
		clu([
			{
				header: "Commands",
				content: generateCommandsSection(commands),
			},
		]),
	);
}
