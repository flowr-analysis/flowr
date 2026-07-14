/**
 * On-disk schema of the `flowr-sigdb` database (schema 4): the constants, enums, numeric tuple forms and
 * data interfaces that define the serialized format and its read view. The reader/writer/builder logic that
 * operates on these lives in `./sigdb` (which re-exports this module, so `./sigdb` stays the single entry point).
 */

/** The definition location of the binding, with a file path usually relative to the package project root. */
export interface SigDefinitionLocation {
	readonly file: string
	readonly line: number
}

/** The resolved identifiers of a singular package version */
export interface LibraryExports {
	/** R version identifier (see `RVersion.parse`) */
	readonly version:    string;
	readonly exported:   readonly string[];
	/** defined-but-not-exported identifiers (only available when internal names are stored, which we usually avoid in the db) */
	readonly internal:   readonly string[];
	readonly deprecated: readonly string[];
	/** flag indicating whether this is a package available on CRAN */
	readonly cran:       boolean;
	/** package documentation url base in case this package is found at a different endpoint */
	readonly cranUrl?:   string;
	/** definition location per identifier, if the database carries them */
	readonly locations?: ReadonlyMap<string, SigDefinitionLocation>;
}

export const SigDbMagic = 'flowr-sigdb';
export const SigDbSchema = 4;
/** default CRAN source-package base URL, used to build a version's tarball link */
export const DefaultCranBase = 'https://cran.r-project.org/src/contrib/';
/**
 * Parameter default expressions longer than this are stored truncated (with a `…` marker): flowR only needs a
 * short lexeme preview of a default, not the whole expression, so a small cap keeps the dictionary compact.
 */
export const MaxDefaultLength = 10;
/** file extension of the (uncompressed) bundle */
export const SigDbExt = '.sigs.ndjson';

/** function-level boolean properties, packed into {@link SigFn}'s bitfield */
export const enum FnProp {
	Exported         = 1,
	HigherOrder      = 2,
	Recursive        = 4,
	CallsDeprecated  = 8,
	CanThrow         = 16,
	Deprecated       = 32,
	CallsInternal    = 64,
	NonDeterministic = 128
}

/** the {@link FnProp} bit to its name (for decoding); integer keys iterate in ascending bit order */
export const FnPropNames: Readonly<Record<FnProp, string>> = {
	[FnProp.Exported]:         'exported',
	[FnProp.HigherOrder]:      'higher-order',
	[FnProp.Recursive]:        'recursive',
	[FnProp.CallsDeprecated]:  'calls-deprecated',
	[FnProp.CanThrow]:         'can-throw',
	[FnProp.Deprecated]:       'deprecated',
	[FnProp.CallsInternal]:    'calls-internal',
	[FnProp.NonDeterministic]: 'non-deterministic'
};

/** parameter flags, packed into {@link SigParam}'s flag int */
export const enum ParamFlag {
	/** forced: the argument is always evaluated (crawlr `always-read`) */
	Forced  = 1,
	/** the argument has no default value (crawlr `missing`) */
	Missing = 2
}

/**
 * One parameter of a signature (position implied by array order): just `nameIdx`, or `[nameIdx, flags]`,
 * or `[nameIdx, flags, defaultIdx]`. All indices point into the global string dictionary.
 */
export type SigParam = number | [nameIdx: number, flags: number] | [nameIdx: number, flags: number, defaultIdx: number];
/** a full signature: the ordered parameter list */
export type Sig = SigParam[];
/** one function record `[nameIdx, sigIdx, cgIdx, propBits, fileIdx, line]` (`sigIdx`/`cgIdx`/`fileIdx` are -1 when absent) */
export type SigFn = [nameIdx: number, sigIdx: number, cgIdx: number, propBits: number, fileIdx: number, line: number];

/** the kind of a package dependency (mirrors the DESCRIPTION fields) */
export const enum DepType { Depends = 0, Imports = 1, LinkingTo = 2, Suggests = 3, Enhances = 4 }
/** the {@link DepType} values in order, with their names (for decoding) */
export const DepTypeNames = ['depends', 'imports', 'linkingTo', 'suggests', 'enhances'] as const;

/** one dependency: `[nameIdx, type]` or `[nameIdx, type, constraintIdx]` (indices into the global dictionary) */
export type SigDep = [nameIdx: number, type: DepType] | [nameIdx: number, type: DepType, constraintIdx: number];

/**
 * A self-contained package. A `versions[ver]` entry is a **delta-encoded** ascending list of indices into
 * {@link PkgBlob.fns} (cumulative-sum to decode); its long runs of `1` just mean a version's functions sit in
 * consecutive pool slots, which brotli collapses on disk. See {@link PkgBlobTuple} for the on-disk order.
 */
export interface PkgBlob {
	sigs:          Sig[];
	cgs:           number[][];
	fns:           SigFn[];
	/** version name to a delta-encoded ascending list of indices into {@link PkgBlob.fns} */
	versions:      Record<string, number[]>;
	/** the subset of {@link PkgBlob.versions} that are not from CRAN (usually empty, so left undefined in memory) */
	noncran?:      string[];
	/** pool of unique dependency lists (shared across a package's versions) */
	deps:          SigDep[][];
	/** version name to an index into {@link PkgBlob.deps} (absent when the version declares no dependencies) */
	depsByVersion: Record<string, number>;
	/** version name to its release date as **days since the Unix epoch** (absent when the date is unknown) */
	dates:         Record<string, number>;
}
/** on-disk tuple form of a {@link PkgBlob}: `[sigs, cgs, fns, versions, noncran, deps, depsByVersion, dates]` */
export type PkgBlobTuple = [Sig[], number[][], SigFn[], Record<string, number[]>, string[], SigDep[][], Record<string, number>, Record<string, number>?];

/**
 * Per-package metadata. The optional 4th element marks an **R-core / base package** (`base`, `stats`,
 * `parallel`, the historical `mva`/`nls`/…): for these the version keys are the R releases during which
 * the package shipped with core R, so the set of versions is exactly the R versions it was part of core.
 */
export type SigDbPkgMeta = [latest: string, archived: number, downloads: number, core?: number];

/**
 * Temporal tier of a bundle's packages:
 * - `current` -- only each package's latest version.
 * - `full`    -- every version (self-contained history).
 * - `history` -- every version EXCEPT the latest. This is the delta a `current` bundle already carries, so a
 *                `history` bundle mounts beside a `current`/slim one to add the older versions with no duplicate
 */
export type SigDbTier = 'full' | 'current' | 'history';
/** popularity shard: `top` keeps the most-downloaded packages, `rest` the remainder (undefined = all) */
export type SigDbShard = 'top' | 'rest';

export interface SigDbContent {
	readonly version:        number;
	readonly date:           string;
	readonly generated:      number;
	/** temporal tier of this bundle */
	readonly tier:           SigDbTier;
	/** popularity shard, when the bundle was split by download rank */
	readonly shard?:         SigDbShard;
	/** the download-rank cutoff used for {@link SigDbContent.shard} */
	readonly topN?:          number;
	/** which information this bundle stores */
	readonly features?:      Required<SigDbFeatures>;
	readonly packages:       number;
	readonly versions:       number;
	readonly functions:      number;
	readonly uniquePackages: number;
	readonly strings:        number;
	readonly hash:           string;
}

export interface SigDb {
	format:    typeof SigDbMagic;
	schema:    typeof SigDbSchema;
	scope:     'signatures';
	content:   SigDbContent;
	cranBase?: string;
	/** global string dictionary */
	strings:   string[];
	/** unique per-package blobs */
	blobs:     PkgBlob[];
	/** package name to its index into {@link SigDb.blobs} */
	pkgs:      Record<string, number>;
	/** package name to its {@link SigDbPkgMeta} */
	meta:      Record<string, SigDbPkgMeta>;
}

export interface SigParamInfo {
	readonly name:     string;
	readonly forced?:  boolean;
	/** the argument has no default value */
	readonly missing?: boolean;
	readonly default?: string;
}
export interface SigFunctionInfo {
	readonly name:    string;
	/** bitfield of {@link FnProp} (must set {@link FnProp.Exported} for exported functions) */
	readonly props:   number;
	readonly params:  readonly SigParamInfo[];
	/** named callees (order/duplication irrelevant; deduped + sorted internally) */
	readonly callees: readonly string[];
	readonly file?:   string;
	readonly line?:   number;
}
/** one declared package dependency, e.g. `{ name: 'testthat', type: Suggests, constraint: '>= 2.1.0' }` */
export interface SigDependencyInfo {
	readonly name:        string;
	readonly type:        DepType;
	/** the version qualifier as written in DESCRIPTION, e.g. `>= 3.0.0` (absent = any version) */
	readonly constraint?: string;
}
export interface SigVersionInfo {
	readonly cran:          boolean;
	readonly functions:     readonly SigFunctionInfo[];
	/** declared dependencies of this version (Depends/Imports/LinkingTo/Suggests/Enhances) */
	readonly dependencies?: readonly SigDependencyInfo[];
	/** release date as milliseconds since the Unix epoch (stored at day granularity, used to find the newest release) */
	readonly date?:         number;
}

/**
 * Which information to store in a bundle (default: everything). Turning a feature off shrinks the
 * database -- e.g. an exports-and-dependencies-only bundle omits the (largest) call graphs and signatures.
 * The export view (exported/internal/deprecated) is always available.
 */
export interface SigDbFeatures {
	/** parameter lists (names, forced/optional, defaults) -- default true */
	signatures?:   boolean;
	/** per-function call graphs (named callees) -- default true */
	callGraphs?:   boolean;
	/** definition locations (file + line) -- default true */
	locations?:    boolean;
	/** per-version declared dependencies -- default true */
	dependencies?: boolean;
}
