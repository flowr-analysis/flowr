import { type Range, minVersion } from 'semver';
import { guard } from '../../../util/assert';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { FlowrNamespaceFile, setCallable } from '../file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../context/flowr-file';
import { RRange } from '../../../util/r-version';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

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

		// an explicit `generic`/`className` pair -> S3 method lookup
		if(className) {
			const classes = this.namespaceInfo.exportS3Generics.get(name);
			return classes ? classes.includes(className) : false;
		}

		// a directly exported symbol/function - this also covers dotted plain exports such as
		// `solve.QP`, `as.Date` or `read.csv` that are not S3 methods
		if(this.namespaceInfo.exportedFunctions.includes(name) || this.namespaceInfo.exportedSymbols.includes(name)) {
			return true;
		}

		// otherwise it may be an S3 method `generic.class` whose exported generic reconstructs it
		if(name.includes('.')) {
			const dot = name.indexOf('.');
			const classes = this.namespaceInfo.exportS3Generics.get(name.slice(0, dot));
			return classes ? classes.includes(name.slice(dot + 1)) : false;
		}

		return false;
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

		this.resolvedVersion = resolvedVersion ?? this.resolvedVersion;
		this.type = type ?? this.type;
		this.dependencies = dependencies ?? this.dependencies;
		this.namespaceInfo = namespaceInfo ?? this.namespaceInfo;

		if(versionConstraints !== undefined) {
			for(const constraint of versionConstraints) {
				this.versionConstraints.push(constraint);
			}
			// sources may disagree, which `hasSatisfiableVersion` reports rather than this failing
			this.derivedVersion = this.deriveVersion() ?? this.derivedVersion;
		}
	}

	/** The combined (intersected) range of all recorded constraints, or `undefined` if none were given. */
	public deriveVersion(): Range | undefined {
		return this.versionConstraints.length > 0
			? RRange.parse(this.versionConstraints.map(c => c.raw).join(' '))
			: undefined;
	}

	/** Whether some concrete version can satisfy every recorded constraint at once. */
	public hasSatisfiableVersion(): boolean {
		return this.derivedVersion !== undefined && minVersion(this.derivedVersion) !== null;
	}

	public static parsePkgVersionRange(constraint?: string, version?: string): Range | undefined {
		if(version) {
			return constraint ? RRange.parse(constraint + version) : RRange.parse(version);
		} else {
			return undefined;
		}
	}

	public static functionIdentifier(dependency: string, func: string): string{
		return NodeId.pkgFnName(dependency, func);
	}
}
