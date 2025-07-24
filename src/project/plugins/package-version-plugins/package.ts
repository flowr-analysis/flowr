import { Range } from 'semver';

export type PackageType = 'package' | 'system' | 'r';

export class Package {
	public name?:         string;
	public version?:      Range;
	public type?:         PackageType;
	public dependencies?: Package[];

	constructor(name?: string, version?: Range, type?: PackageType, dependencies?: Package[]) {
		this.addInfo(name, version, type, dependencies);
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