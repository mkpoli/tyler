import * as prettier from "prettier";
import prettierPluginToml from "prettier-plugin-toml";
import * as toml from "smol-toml";

export async function stringifyToml(something: unknown): Promise<string> {
	return await prettier.format(toml.stringify(something), {
		parser: "toml",
		plugins: [prettierPluginToml],
	});
}
