import { Range } from 'semver';
import { guard } from '../../../util/assert';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';

export type PackageType = 'package' | 'system' | 'r';

export type PackageOptions = {
	derivedVersion?:     Range;
	type?:               PackageType;
	dependencies?:       Package[];
	namespaceInfo?:      NamespaceInfo;
	versionConstraints?: Range[];
}

export class Package {
	public name:               string;
	public derivedVersion?:    Range;
	public type?:              PackageType;
	public dependencies?:      Package[];
	public namespaceInfo?:     NamespaceInfo;
	public versionConstraints: Range[] = [];

	constructor(info: { name: string } & PackageOptions) {
		this.name = info.name;
		this.addInfo(info);
	}

	has(name: string, className?: string): boolean {
		if(!this.namespaceInfo) {
			return false;
		}

		if(name.includes('.')) {
			const [genericSplit, classSplit] = name.split('.');
			const classes = this.namespaceInfo.exportS3Generics.get(genericSplit);
			return classes ? classes.includes(classSplit) : false;
		}

		if(className) {
			const classes = this.namespaceInfo.exportS3Generics.get(name);
			return classes ? classes.includes(className) : false;
		}

		return this.namespaceInfo.exportedFunctions.includes(name) || this.namespaceInfo.exportedSymbols.includes(name);
	}

	s3For(generic: string): string[] {
		return this.namespaceInfo?.exportS3Generics.get(generic) ?? [];
	}

	public mergeInPlace(other: Package): void {
		guard(this.name === other.name, 'Can only merge packages with the same name');
		this.addInfo(
			{
				type:               other.type,
				dependencies:       other.dependencies,
				namespaceInfo:      other.namespaceInfo,
				versionConstraints: other.versionConstraints
			}
		);
	}

	public addInfo(info: PackageOptions): void {
		const {
			type,
			dependencies,
			namespaceInfo,
			versionConstraints
		} = info;

		if(type !== undefined) {
			this.type = type;
		}
		if(dependencies !== undefined) {
			this.dependencies = dependencies;
		}
		if(namespaceInfo !== undefined) {
			this.namespaceInfo = namespaceInfo;
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