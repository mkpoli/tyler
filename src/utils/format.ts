import * as prettier from "prettier";
import prettierPluginToml from "prettier-plugin-toml";

export async function formatToml(toml: string): Promise<string> {
	return prettier.format(toml, {
		parser: "toml",
		plugins: [prettierPluginToml],
	});
}
