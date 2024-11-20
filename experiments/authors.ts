import { getTypstIndexPackageMetadata } from "@/build/package";

const versionIndex = await getTypstIndexPackageMetadata();

for (const pkg of versionIndex) {
	for (const author of pkg.authors ?? []) {
		if (
			!/^[^<]*(?: <(?:[a-zA-Z0-9_\-\.]*)?@[^<>]+>|<https?:\/\/[^<>]+>)?$/.test(
				author,
			)
		) {
			console.log({
				name: pkg.name,
				version: pkg.version,
				authors: pkg.authors,
			});
		}
	}
}
