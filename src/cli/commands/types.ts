import type { OptionDefinition } from "command-line-args";

// Typst Script magic to convert OptionDefinition to Result

export type Command<T = Record<string, unknown>> = {
	name: string | undefined;
	description: string;
	options: Option[];
	run: (options: T) => Promise<void>;
	usage: string;
};

export type Option = OptionDefinition & {
	description: string;
	hide?: boolean;
};
