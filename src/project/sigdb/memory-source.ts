import type { PackageSignatureSource } from './reader';
import type { VersionRelease } from './sigdb-version';
import type { LibraryExports } from './schema';
import type { ResolvedDependency } from './decode';
import { RVersion } from '../../util/r-version';
import { classOwnerIndexFor } from './reader';
import { baseRPackages } from '../../util/r-base-packages';

/**
 * One package as {@link MemorySignatureSource} carries it: the exports are what attaching it brings, the rest
 * is what the answers below need to stay honest. Everything but the name and the exports is optional, so a
 * caller may ship no more than it has.
 */
export interface MemoryPackage {
	readonly version?:    string;
	readonly exported:    readonly string[];
	readonly deprecated?: readonly string[];
	readonly s3Classes?:  readonly string[];
	readonly s4Classes?:  readonly string[];
	readonly downloads?:  number;
	readonly deps?:       readonly ResolvedDependency[];
	/** when that version was released, which is what makes it a release rather than a label */
	readonly released?:   Date;
}

/** what {@link LibraryExports.version} says when the source was given no version to claim */
const UnknownVersion = '';

/**
 * A signature source held entirely in memory, for the places that cannot open a database file: a browser
 * (the playground bundles its packages rather than reading them) and a test that wants to state a package's
 * exports outright. It answers what a package brings into scope; the per-function view a real database
 * decodes from its blobs is not part of what it can say, so those answers stay empty.
 * @see {@link SigDatabase} - the file-backed source
 */
export class MemorySignatureSource implements PackageSignatureSource {
	private readonly packages: ReadonlyMap<string, MemoryPackage>;
	/** reverse index `class -> owning package`, built on first use (see {@link classOwner}) */
	private classIndex:        Map<string, string> | undefined;

	public constructor(packages: Readonly<Record<string, MemoryPackage>> | ReadonlyMap<string, MemoryPackage>) {
		this.packages = packages instanceof Map ? packages : new Map(Object.entries(packages));
	}

	public has(pkg: string): boolean {
		return this.packages.has(pkg);
	}

	public hasVersion(pkg: string, version: string): boolean {
		const known = this.versionOf(pkg);
		return known !== UnknownVersion && known === version;
	}

	public isCranVersion(pkg: string, version: string): boolean {
		return this.hasVersion(pkg, version);
	}

	/** an in-memory source states no repository */
	public sourceOf(): undefined {
		return undefined;
	}

	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		const found = this.packages.get(pkg);
		/* a source given no version has one answer and gives it whatever is asked for: it cannot say no */
		if(found === undefined || !this.answersFor(pkg, version)) {
			return undefined;
		}
		return {
			version:    this.versionOf(pkg),
			exported:   found.exported,
			internal:   [],
			deprecated: found.deprecated ?? [],
			s3Classes:  found.s3Classes ?? [],
			s4Classes:  found.s4Classes ?? [],
			cran:       true
		};
	}

	public packagesExporting(name: string): readonly string[] {
		return [...this.packages]
			.filter(([, p]) => p.exported.includes(name))
			.sort(([an, a], [bn, b]) => (b.downloads ?? 0) - (a.downloads ?? 0) || an.localeCompare(bn))
			.map(([pkg]) => pkg);
	}

	public classOwner(className: string, version?: string): string | undefined {
		if(version !== undefined) {
			return this.packageNames().find(pkg => {
				const lib = this.lookup(pkg, version);
				return (lib?.s3Classes.includes(className) ?? false) || (lib?.s4Classes.includes(className) ?? false);
			});
		}
		this.classIndex ??= classOwnerIndexFor(this, this.packageNames());
		return this.classIndex.get(className);
	}

	/** no blobs to decode, so the rich per-function view has nothing to give */
	public functions(): undefined {
		return undefined;
	}

	public functionByName(): undefined {
		return undefined;
	}

	public transitiveCallees(): undefined {
		return undefined;
	}

	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		const found = this.packages.get(pkg);
		if(found === undefined || !this.answersFor(pkg, version)) {
			return undefined;
		}
		return [...found.deps ?? []];
	}

	public packageNames(): string[] {
		return [...this.packages.keys()];
	}

	public isBaseR(pkg: string): boolean {
		return baseRPackages().includes(pkg);
	}

	public downloads(pkg: string): number {
		return this.packages.get(pkg)?.downloads ?? 0;
	}

	/** the R releases a base package shipped with are a property of the database, which this source has none of */
	public coreVersions(): undefined {
		return undefined;
	}

	public releaseDate(pkg: string): Date | undefined {
		return this.packages.get(pkg)?.released;
	}

	public releaseDates(pkg: string): VersionRelease[] {
		const version = this.latestVersion(pkg);
		const date = this.releaseDate(pkg);
		return version === undefined || date === undefined ? [] : [{ version, date }];
	}

	public latestVersion(pkg: string): RVersion | undefined {
		const known = this.versionOf(pkg);
		return known === UnknownVersion ? undefined : RVersion.parse(known);
	}

	/** nothing is held open */
	public close(): void {
		/* nothing to release */
	}

	/** whether the package answers a lookup for `version`, which an unversioned one always does */
	private answersFor(pkg: string, version: string | undefined): boolean {
		return version === undefined || this.versionOf(pkg) === UnknownVersion || this.versionOf(pkg) === version;
	}

	private versionOf(pkg: string): string {
		return this.packages.get(pkg)?.version ?? UnknownVersion;
	}
}

/**
 * A {@link MemorySignatureSource} from what a page can carry: `package -> [version, release date, ...exports]`.
 * The version is what the exports were read from, so recording it is what keeps a consumer from being told
 * the package is unknown when only its history is.
 */
export function memorySourceOfPackages(packages: Readonly<Record<string, readonly string[]>>): MemorySignatureSource {
	return new MemorySignatureSource(Object.fromEntries(
		Object.entries(packages).map(([pkg, [version = '', released = '', ...exported]]) => [pkg, {
			exported,
			version:  version.length > 0 ? version : undefined,
			released: released.length > 0 ? new Date(released) : undefined
		}])
	));
}
