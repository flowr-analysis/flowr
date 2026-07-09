import type { Range } from 'semver';
import { guard } from '../../../util/assert';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { FlowrNamespaceFile, setCallable } from '../file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../context/flowr-file';
import { parseRRange } from '../../../util/r-version';

export type PackageType = 'package' | 'system' | 'r';

export type PackageOptions = {
	derivedVersion?:     Range;
	type?:               PackageType;
	dependencies?:       Package[];
	namespaceInfo?:      NamespaceInfo;
	versionConstraints?: Range[];
	/** the concrete version the exports were resolved from (e.g. the package database entry), for information only */
	resolvedVersion?:    string;
};

export class Package {
	public name:               string;
	public derivedVersion?:    Range;
	public type?:              PackageType;
	public dependencies?:      Package[];
	public namespaceInfo?:     NamespaceInfo;
	public versionConstraints: Range[] = [];
	public resolvedVersion?:   string;

	constructor(info: { name: string } & PackageOptions) {
		this.name = info.name;
		this.addInfo(info);
	}

	/** Builds a package from a raw `NAMESPACE` body and its list of callable exports. */
	public static fromConstants(name: string, namespace: string, callable: string[]): Package {
		return new Package({
			name,
			namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespace)).content().current, callable)
		});
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
				versionConstraints: other.versionConstraints,
				resolvedVersion:    other.resolvedVersion
			}
		);
	}

	public addInfo(info: PackageOptions): void {
		const {
			type,
			dependencies,
			namespaceInfo,
			versionConstraints,
			resolvedVersion
		} = info;

		if(resolvedVersion !== undefined) {
			this.resolvedVersion = resolvedVersion;
		}
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

	public static funcIdentif(dependency: string, func: string): string{
		return `${dependency}:${func}`;
	}
}
