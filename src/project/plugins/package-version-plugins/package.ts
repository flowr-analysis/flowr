import { Range } from 'semver';

type PackageType = 'package' | 'system' | 'r';

export class Package {
	public name:          string;
	public version?:      Range;
	public dependencies?: Package[];
	public type:          PackageType;

	public constructor(name: string, type: PackageType, version: Range | undefined,	dependencies?: Package[]) {
		this.name = name;
		this.type = type;
		this.version = version;
		this.dependencies = dependencies;
	}

	public addInfo(name?: string, versionConstraint?: Range, type?: PackageType, dependencies?: Package[]): void {
		if(name !== undefined) {
			this.name = name;
		}
		if(versionConstraint !== undefined) {
			this.version = versionConstraint;
		}
		if(type !== undefined) {
			this.type = type;
		}
		if(dependencies !== undefined) {
			this.dependencies = dependencies;
		}
	}

	public getInfo(): this {
		return this;
	}

	public static parsePackageVersionRange(constraint?: string, version?: string): Range | undefined {
		if(version) {
			return constraint ? new Range(constraint + version) : new Range(version);
		} else {
			return undefined;
		}
	}
}