import { type Range, minVersion } from 'semver';
import { guard } from '../../../util/assert';
import type { NamespaceInfo } from '../file-plugins/files/flowr-namespace-file';
import { FlowrNamespaceFile, setCallable } from '../file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../context/flowr-file';
import { RRange } from '../../../util/r-version';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

export type PackageType = 'package' | 'system' | 'r';

/** what a source can contribute about a package; everything else a {@link Package} exposes is derived from these */
export type PackageOptions = {
	type?:               PackageType;
	dependencies?:       Package[];
	namespaceInfo?:      NamespaceInfo;
	/** what this source declared for the package (a `DESCRIPTION` range, a lockfile pin, ...) */
	versionConstraints?: Range[];
	/** the concrete version the exports were resolved from (e.g. the package database entry), for information only */
	resolvedVersion?:    string;
};

/**
 * A package as the sources describe it, accumulated with {@link addInfo}/{@link mergeInPlace}: only those may
 * change it, everything else reads. Its three version views run from the rawest to the most concrete:
 * - {@link versionConstraints}: what each source declared, unmerged.
 * - {@link derivedRange}: their intersection, whether or not a version can satisfy it (see
 *   {@link hasSatisfiableVersion}, and `inferredRange` on the dependencies context for the range that is only
 *   handed out once it is).
 * - {@link resolvedVersion}: the one concrete version the exports were read from.
 */
export class Package {
	public readonly name:                 string;
	private _type?:                       PackageType;
	private _dependencies?:               Package[];
	private _namespaceInfo?:              NamespaceInfo;
	private _resolvedVersion?:            string;
	private readonly _versionConstraints: Range[] = [];
	/** the intersection of {@link versionConstraints}, computed on demand and dropped whenever one is added */
	private _derivedRange?:               Range;

	public get type(): PackageType | undefined {
		return this._type;
	}
	public get dependencies(): readonly Package[] | undefined {
		return this._dependencies;
	}
	public get namespaceInfo(): NamespaceInfo | undefined {
		return this._namespaceInfo;
	}
	public get resolvedVersion(): string | undefined {
		return this._resolvedVersion;
	}
	public get versionConstraints(): readonly Range[] {
		return this._versionConstraints;
	}
	public get derivedRange(): Range | undefined {
		this._derivedRange ??= this.deriveRange();
		return this._derivedRange;
	}

	/** {@link derivedRange} if a source declared one, else the {@link resolvedVersion} the exports were read from. */
	public get effectiveRange(): Range | undefined {
		return this.derivedRange ?? (this._resolvedVersion !== undefined ? RRange.parse('=' + this._resolvedVersion) : undefined);
	}

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
		this.addInfo({
			type:               other.type,
			dependencies:       other._dependencies,
			namespaceInfo:      other.namespaceInfo,
			versionConstraints: other._versionConstraints,
			resolvedVersion:    other.resolvedVersion
		});
	}

	public addInfo({ type, dependencies, namespaceInfo, versionConstraints, resolvedVersion }: PackageOptions): void {
		this._resolvedVersion = resolvedVersion ?? this._resolvedVersion;
		this._type = type ?? this._type;
		this._dependencies = dependencies ?? this._dependencies;
		this._namespaceInfo = namespaceInfo ?? this._namespaceInfo;
		if(versionConstraints !== undefined && versionConstraints.length > 0) {
			this._versionConstraints.push(...versionConstraints);
			this._derivedRange = undefined;   // re-derived on the next read, once every source has had its say
		}
	}

	/** The combined (intersected) range of all recorded constraints, or `undefined` if none were given. */
	private deriveRange(): Range | undefined {
		// sources may disagree, which `hasSatisfiableVersion` reports rather than this failing
		return RRange.intersect(this._versionConstraints);
	}

	/** Whether some concrete version can satisfy every recorded constraint at once. */
	public hasSatisfiableVersion(): boolean {
		const range = this.derivedRange;
		return range !== undefined && minVersion(range) !== null;
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
