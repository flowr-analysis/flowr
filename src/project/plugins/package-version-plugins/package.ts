import { Range } from 'semver';

export type PackageType = 'package' | 'system' | 'r';

export class Package {
	public name?:              string;
	public derivedVersion?:    Range;
	public type?:              PackageType;
	public dependencies?:      Package[];
	public versionConstraints: Range[] = [];

	constructor(name?: string, type?: PackageType, dependencies?: Package[], ...versionConstraints: readonly Range[]) {
		this.addInfo(name, type, dependencies, ...(versionConstraints ?? []));
	}

	public addInfo(name?: string, type?: PackageType, dependencies?: Package[], ...versionConstraints: readonly Range[]): void {
		if(name !== undefined) {
			this.name = name;
		}
		if(type !== undefined) {
			this.type = type;
		}
		if(dependencies !== undefined) {
			this.dependencies = dependencies;
		}
		if(versionConstraints !== undefined) {
			this.derivedVersion ??= versionConstraints[0];

			for(const constraint of versionConstraints) {
				if(!this.derivedVersion?.intersects(constraint)) {
					throw Error('Version constraint mismatch!');
				}
				this.versionConstraints.push(constraint);
				this.derivedVersion = this.deriveVersion();
			}
		}
	}

	public getInfo(): this {
		return this;
	}

	public deriveVersion(): Range | undefined {
		return this.versionConstraints.length > 0
			? new Range(this.versionConstraints.map(c => c.raw).join(' '))
			: undefined;
	}

	public static parsePackageVersionRange(constraint?: string, version?: string): Range | undefined {
		if(version) {
			return constraint ? new Range(constraint + version) : new Range(version);
		} else {
			return undefined;
		}
	}
}