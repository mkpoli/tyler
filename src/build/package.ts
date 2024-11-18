import chalk from "chalk";
import * as toml from "smol-toml";

export type TypstToml = {
	package: {
		name: string;
		version: string;
		description?: string;
		entrypoint?: string;
	};
	template?: {
		path: string;
		entrypoint: string;
	};
	tool?: Record<string, unknown>;
};

export type TypstIndexPackageMetadata = Partial<{
	name: string;
	version: string;
	entrypoint: string;
	authors: string[];
	license: string;
	description: string;
	repository: string;
	keywords: string[];
	categories: string[];
	compiler: string;
	exclude: string[];
	template: {
		path: string;
		version: string;
		entrypoint: string;
		authors: string[];
		license: string;
		description: string;
		repository: string;
		keywords: string[];
		categories: string[];
	};
}>;

export async function readTypstToml(path: string): Promise<TypstToml> {
	try {
		return toml.parse(await Bun.file(path).text()) as TypstToml;
	} catch (error) {
		throw new Error("[Tyler] `typst.toml` is invalid");
	}
}

const VERSION_INDEX_URL = "https://packages.typst.org/preview/index.json";
export async function getTypstIndexPackageMetadata(): Promise<
	TypstIndexPackageMetadata[]
> {
	const res = await fetch(VERSION_INDEX_URL);
	const versionIndex: TypstIndexPackageMetadata[] = await res.json();
	console.info(
		`[Tyler] Found ${chalk.green(versionIndex.length)} packages in the Typst preview package index`,
	);
	return versionIndex;
}
