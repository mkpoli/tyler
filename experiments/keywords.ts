import { getTypstIndexPackageMetadata } from "@/build/package";

const versionIndex = await getTypstIndexPackageMetadata();

const keywords = new Set<string>();
for (const pkg of versionIndex) {
	if (pkg.keywords) {
		for (const keyword of pkg.keywords) {
			keywords.add(keyword);
		}
	}
}

console.log(keywords);
