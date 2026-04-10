import { Range } from 'semver';
import { guard } from '../../../util/assert';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { parseRRange } from '../../../util/r-version';

export type PackageType = 'package' | 'system' | 'r';

export interface SerializedPackage{
    name:               string;
    type?:              PackageType;
    derivedVersion?:    string;
    versionConstraints: string[];
    dependencies?:      SerializedPackage[];
    namespaceInfo?:     SerializedNamespaceInfo;
}

export interface SerializedNamespaceInfo {
	exportedSymbols:      string[];
	exportedFunctions:    string[];
	exportS3Generics:     [string, string[]][];
	exportedPatterns:     string[];
	importedPackages:     [string, string[] | 'all'][];
	loadsWithSideEffects: boolean;
}

function serializeNamespaceInfo(info: NamespaceInfo): SerializedNamespaceInfo {
	return {
		exportedSymbols:      [...info.exportedSymbols],
		exportedFunctions:    [...info.exportedFunctions],
		exportS3Generics:     [...info.exportS3Generics.entries()].map(([k, v]) => [k, [...v]]),
		exportedPatterns:     [...info.exportedPatterns],
		importedPackages:     [...info.importedPackages.entries()].map(([k, v]) => [k, v === 'all' ? 'all' : [...v]]),
		loadsWithSideEffects: info.loadsWithSideEffects,
	};
}

function deserializeNamespaceInfo(info: SerializedNamespaceInfo): NamespaceInfo {
	return {
		exportedSymbols:      [...info.exportedSymbols],
		exportedFunctions:    [...info.exportedFunctions],
		exportS3Generics:     new Map(info.exportS3Generics.map(([k, v]) => [k, [...v]])),
		exportedPatterns:     [...info.exportedPatterns],
		importedPackages:     new Map(info.importedPackages.map(([k, v]) => [k, v === 'all' ? 'all' : [...v]])),
		loadsWithSideEffects: info.loadsWithSideEffects,
	};
}

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
					throw new Error('Version constraint mismatch!');
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
			? parseRRange(this.versionConstraints.map(c => c.raw).join(' '))
			: undefined;
	}

	public static parsePackageVersionRange(constraint?: string, version?: string): Range | undefined {
		if(version) {
			return constraint ? parseRRange(constraint + version) : parseRRange(version);
		} else {
			return undefined;
		}
	}

	public toSerializable(): SerializedPackage {
		return {
			name:               this.name,
			type:               this.type,
			derivedVersion:     this.derivedVersion !== undefined ? this.derivedVersion.raw : undefined,
			versionConstraints: this.versionConstraints.map(v => v.raw),
			dependencies:       this.dependencies !== undefined ? this.dependencies.map(d => d.toSerializable()) : undefined,
			namespaceInfo:      this.namespaceInfo ? serializeNamespaceInfo(this.namespaceInfo) : undefined,
		};
	}

	public static fromSerializable(serializedPackage: SerializedPackage): Package {
		const pkg = new Package({ name: serializedPackage.name, type: serializedPackage.type });

		if(serializedPackage.versionConstraints.length > 0) {
			pkg.addInfo({
				versionConstraints: serializedPackage.versionConstraints.map(v => new Range(v))
			});
		}

		if(serializedPackage.dependencies !== undefined){
			pkg.dependencies = serializedPackage.dependencies.map(d => Package.fromSerializable(d));
		}

		if(serializedPackage.namespaceInfo !== undefined) {
			pkg.namespaceInfo = deserializeNamespaceInfo(serializedPackage.namespaceInfo);
		}

		if(serializedPackage.derivedVersion !== undefined){
			pkg.derivedVersion = new Range(serializedPackage.derivedVersion);
		}

		return pkg;
	}
}