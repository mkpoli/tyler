import { getTypstIndexPackageMetadata } from "@/build/package";

const versionIndex = await getTypstIndexPackageMetadata();

for (const pkg of versionIndex) {
	if (pkg.homepage || pkg.repository) {
		console.log(pkg.homepage, pkg.repository);
	}
}
