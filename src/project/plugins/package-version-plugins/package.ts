import { Range } from 'semver';
import { guard, isNotUndefined } from '../../../util/assert';

export type PackageType = 'package' | 'system' | 'r';

export class Package {
	public name:               string;
	public derivedVersion?:    Range;
	public type?:              PackageType;
	public dependencies?:      Package[];
	public versionConstraints: Range[] = [];

	constructor(name: string, type?: PackageType, dependencies?: Package[], ...versionConstraints: readonly (Range | undefined)[]) {
		this.name = name;
		this.addInfo(type, dependencies, ...(versionConstraints ?? []).filter(isNotUndefined));
	}

	public mergeInPlace(other: Package): void {
		guard(this.name === other.name, 'Can only merge packages with the same name');
		this.addInfo(
			other.type,
			other.dependencies,
			...other.versionConstraints
		);
	}

	public addInfo(type?: PackageType, dependencies?: Package[], ...versionConstraints: readonly Range[]): void {
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