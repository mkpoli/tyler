import { getTypstIndexPackageMetadata } from "@/build/package";

const versionIndex = await getTypstIndexPackageMetadata();

const disciplines = new Set<string>();
for (const pkg of versionIndex) {
	if (pkg.disciplines) {
		for (const discipline of pkg.disciplines) {
			disciplines.add(discipline);
		}
	}
}

console.log(disciplines);

const listed = [
	"agriculture",
	"anthropology",
	"archaeology",
	"architecture",
	"biology",
	"business",
	"chemistry",
	"communication",
	"computer-science",
	"design",
	"drawing",
	"economics",
	"education",
	"engineering",
	"fashion",
	"film",
	"geography",
	"geology",
	"history",
	"journalism",
	"law",
	"linguistics",
	"literature",
	"mathematics",
	"medicine",
	"music",
	"painting",
	"philosophy",
	"photography",
	"physics",
	"politics",
	"psychology",
	"sociology",
	"theater",
	"theology",
	"transportation",
];

console.log(listed.filter((d) => !disciplines.has(d)));

console.log([...disciplines].filter((d) => !listed.includes(d)));
