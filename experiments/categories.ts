import { getTypstIndexPackageMetadata } from "@/build/package";

const versionIndex = await getTypstIndexPackageMetadata();

const categories = new Set<string>();
for (const pkg of versionIndex) {
	if (pkg.categories) {
		for (const category of pkg.categories) {
			categories.add(category);
		}
	}
}

console.log(categories);
