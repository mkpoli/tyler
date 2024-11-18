export interface Config {
	srcdir: string;
	outdir: string;
	ignore: string[];
}

function parseList(value: string): string[] {
	return value.split(",").map((s) => s.trim());
}

export function updateOptionFromConfig<T extends Record<string, unknown>>(
	options: T,
	config: Partial<Config>,
) {
	// CLI options override config options
	return {
		...options,
		srcdir: options.srcdir ?? config.srcdir,
		outdir: options.outdir ?? config.outdir,
		ignore:
			typeof options.ignore === "string"
				? parseList(options.ignore)
				: config.ignore,
	};
}
