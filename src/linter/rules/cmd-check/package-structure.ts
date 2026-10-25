import { DataFile } from './cmd-check-util';
import fs from 'fs';
import path from 'path';
import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { FlowrInlineTextFile } from '../../../project/context/flowr-file';
import { RDAParser, type RObject, type RObjectData } from '../../../project/plugins/file-plugins/files/flowr-rda-file';
import { escapeRegex } from '../../../util/text/strings';
import { getPlatform } from '../../../util/os';
import { type FileResult, fileFindings, MessageAtLocation, onPackageFiles } from './file-checks';
import type { PackageEntry, PackageFiles } from './package-files';

export type PackageStructureKind =
	| 'non-portable-file-name' | 'duplicate-lowercase-name' | 'not-fully-portable-name' | 'long-path' | 'unstorable-path'
	| 'hidden-file' | 'defunct-top-level-file' | 'configure-without-source' | 'configure-in' | 'bashism' | 'unmentioned-license-file' | 'non-standard-top-level' | 'leftover-file'
	| 'empty-r-directory' | 'case-variant-directory' | 'rd2pdf-directory' | 'invalid-file-name' | 'empty-data-directory' | 'empty-demo-directory' | 'demo-non-ascii'
	| 'empty-exec-directory' | 'empty-inst-directory' | 'empty-src-directory' | 'inst-system-subdirectory' | 'misplaced-citation' | 'empty-tests-directory'
	| 'build-vignette-without-output' | 'build-missing-output' | 'build-missing-source' | 'build-missing-code'
	| 'exe-dll-file' | 'executable-file' | 'insufficient-permissions' | 'not-executable' | 'future-timestamp' | 'installed-size'
	| 'large-pdf' | 'crlf-shell-script' | 'vignette-leftover' | 'vignette-source-missing' | 'vignettes-without-inst-doc' | 'vignette-newer'
	| 'no-vignette-builder' | 'file-already-in-r' | 'license-requires-sources' | 'leftover-mistake' | 'knitr-leftover' | 'should-not-install';

export type PackageStructureResult = FileResult<PackageStructureKind>;

export interface PackageStructureConfig extends MergeableRecord {
	/** a path of more than this many bytes (with the package name as prefix) is noted (default `100`) */
	readonly maxPathLength:         number
	/** hidden files and directories (as paths relative to the package root) that are fine */
	readonly hiddenAllowed:         readonly string[]
	/** names of hidden files and directories the CRAN package checks know about */
	readonly cranKnownHidden:       readonly string[]
	/** whether to say for each hidden file whether the CRAN package checks know about it */
	readonly cranPack:              boolean
	/** whether to check for non-standard top-level files and directories (`R CMD check` does with `--as-cran`) */
	readonly checkTopLevel:         boolean
	/** the files and directories that may be at the top level of a package */
	readonly standardTopLevel:      readonly string[]
	/** whether to flag `/bin/bash` and `env bash` in `configure` and `cleanup` (off in `R CMD check` by default) */
	readonly checkBashisms:         boolean
	/** the directories of `inst` that R uses itself */
	readonly reservedInstDirs:      readonly string[]
	/** the installed package size in Mb above which a note is given (default `5`) */
	readonly maxInstalledSizeMb:    number
	/** a PDF in `inst/doc` of more bytes than this is flagged to be compacted (default 1 MiB) */
	readonly maxPdfBytes:           number
	/** whether to flag files and directories modified in the future (`R CMD check` does with `--as-cran`) */
	readonly checkFutureTimestamps: boolean
	/** whether the package is a built tarball (so `inst/doc` is expected to hold the vignette outputs) */
	readonly builtPackage:          boolean
	/** the extensions (without dot) of files that are leftovers when found next to vignettes */
	readonly leftoverExtensions:    readonly string[]
	/** the directories of `inst/doc` that should not be installed */
	readonly docDirsNotInstalled:   readonly string[]
}

export interface PackageStructureMetadata extends MergeableRecord {
	/** the number of files and directories inspected */
	readonly inspectedEntries: number
	/** whether the package was read from the file system, which enables the checks of permissions, times, sizes and executables */
	readonly onDisk:           boolean
}

const PortableNameChars = /[^-A-Za-z0-9._!#$%&+,;=@^(){}'[\]]/;
const InvalidNameChars = /["*:<>?\\|]/;
const ReservedNames = /^(con|prn|aux|clock[$]|nul|lpt[1-9]|com[1-9])$/;
const CodeExtensions = new Set(['R', 'r', 'S', 's', 'q']);
const SweavePattern = /\.[RrSs](nw|tex)$/;
const VignettePattern = /\.([RrSs](nw|tex)|Rmd|rmd|qmd|Rmarkdown|rmarkdown)$/;
const ValidVignetteName = /^[A-Za-z][A-Za-z0-9._-]+$/;
const ReusedDocExtensions = /\.(tex|lyx|png|jpg|jpeg|gif|ico|bst|cls|sty|ps|eps|img)$/i;
const LicenseNotice = ['%% This generated file may be distributed as long as the', '%% original source files, as listed above, are part of the', '%% same distribution.'];
const FosLicense = /\b(GPL|LGPL|AGPL|MIT|BSD|Apache|Artistic|MPL|Mozilla|CC0|CC BY|EUPL|CeCILL|Boost|EPL|Eclipse|CPL|zlib|GNU)/i;
const LimitedLicense = /non-?commercial|\bNC\b|restricts|academic/i;
const AlreadyInR = ['jss.cls', 'jss.bst', 'Rd.sty', 'Sweave.sty'];
const ShippedStyles = ['jss.cls', 'jss.drv', 'Rnews.sty', 'RJournal.sty'];
const CaseVariants = new Map([['r', 'R'], ['MAN', 'man'], ['DATA', 'data']]);
const LooseDirs = ['vignettes', 'inst/doc'];
const MaxTarPathLength = 256;
const TimeToleranceMs = 10_000;
const FutureLeewayMs = 300_000;
const Mb = 1024 * 1024;
const Quote = (s: string) => `'${s}'`;
const base = (p: string) => path.posix.basename(p);
const ext = (p: string) => path.posix.extname(p).slice(1);
const parent = (e: PackageEntry) => path.posix.dirname(e.relative);
const under = (e: PackageEntry, dir: string) => e.relative.startsWith(`${dir}/`);
const what = (e: PackageEntry) => e.isDirectory ? 'directory' : 'file';
const isFile = (e: PackageEntry) => !e.isDirectory;
const alnumStart = (name: string) => /^[A-Za-z0-9]/.test(base(name));

/** whether the leading bytes are those of a native executable (ELF, PE, Mach-O), as `file` would call it one */
function isNativeExecutable(file: string, mode: number): boolean {
	const buf = Buffer.alloc(20);
	let n: number;
	try {
		const fd = fs.openSync(file, 'r');
		try {
			n = fs.readSync(fd, buf, 0, 20, 0);
		} finally {
			fs.closeSync(fd);
		}
	} catch{
		return false;
	}
	const magic = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
	if(magic(0x7f, 0x45, 0x4c, 0x46) && n === 20) {
		const type = buf[5] === 2 ? buf.readUInt16BE(16) : buf.readUInt16LE(16);
		return type === 2 || type === 3 && (mode & 0o111) !== 0 && !/\.so(\.|$)/.test(file);
	}
	return magic(0x4d, 0x5a) || n === 20 && (magic(0xfe, 0xed, 0xfa, 0xce) || magic(0xfe, 0xed, 0xfa, 0xcf) ? buf.readUInt32BE(12) === 2
		: (magic(0xce, 0xfa, 0xed, 0xfe) || magic(0xcf, 0xfa, 0xed, 0xfe)) && buf.readUInt32LE(12) === 2);
}

/** the string columns of the data frame a serialized `build/vignette.rds` holds */
function readVignetteIndex(file: string): ReadonlyMap<string, readonly string[]> | undefined {
	try {
		const obj = new RDAParser(new FlowrInlineTextFile(file, ''), false).parseObject() as RObjectData;
		let names: string[] = [];
		for(let a: RObject | undefined = obj.attributes?.[0]; a !== undefined && typeof a === 'object'; a = a.cdr) {
			if(typeof a.tag === 'object' && a.tag.name === 'names' && typeof a.car === 'object' && Array.isArray(a.car.value)) {
				names = a.car.value as string[];
			}
		}
		return new Map(names.map((n, i) => [n, (Array.isArray(obj.value) && Array.isArray((obj.value[i] as RObjectData)?.value) ? (obj.value[i] as RObjectData).value : []) as string[]]));
	} catch{
		return undefined;
	}
}

interface Env {
	readonly pf:           PackageFiles
	readonly config:       PackageStructureConfig
	readonly pkgName:      string
	readonly license:      string
	readonly foss:         boolean
	readonly files:        readonly PackageEntry[]
	readonly kinds:        ReadonlyMap<string, boolean>
	readonly children:     (dir: string) => readonly PackageEntry[]
	readonly size:         (e: PackageEntry) => number
	readonly firstByLower: ReadonlyMap<string, string>
	readonly binary:       ReadonlySet<string>
	readonly demos:        readonly string[]
	readonly sources:      ReadonlySet<string>
	readonly stemPdf:      RegExp | undefined
	readonly docTimes:     ReadonlyMap<string, number>
}

const codeFiles = (env: Env) => ['R', 'R/unix', 'R/windows'].flatMap(d => env.children(d)).filter(e => !e.isDirectory && CodeExtensions.has(ext(e.relative)) && alnumStart(e.relative));
const isDir = (env: Env, rel: string) => env.kinds.get(rel) === true;
const isTop = (e: PackageEntry) => !e.relative.includes('/');
const topFile = (...names: readonly string[]) => (e: PackageEntry) => isTop(e) && !e.isDirectory && names.includes(e.relative);
const generated = (env: Env) => /Generated by GNU Autoconf/i.test(env.pf.read('configure') ?? '');
const bashism = (e: PackageEntry, env: Env) => {
	const first = env.pf.read(e.relative)?.split(/\r?\n/, 1)[0] ?? '';
	return /^#! *\/bin\/bash/.test(first) ? '/bin/bash is not portable' : /^#!.*env bash/.test(first) ? "'env bash' is not portable as bash need not be installed" : undefined;
};

function nonPortable(e: PackageEntry): boolean {
	const b = base(e.relative);
	return InvalidNameChars.test(b) || /\p{Cc}/u.test(b) || parent(e).endsWith('man') && /[^ -~]|%/.test(b) || ReservedNames.test(b.toLowerCase().replace(/[.].*/, ''));
}
function tarPath(e: PackageEntry, env: Env): { full: string, bytes: number, storable: boolean } {
	const full = `${env.pkgName}/${e.relative}`;
	const raw = Buffer.from(full);
	const slash = raw.subarray(0, 155).lastIndexOf('/');
	return { full, bytes: raw.length, storable: raw.length <= MaxTarPathLength && slash >= 0 && slash + 100 >= raw.length };
}

const pathNote = (e: PackageEntry, env: Env, lead: string) => {
	const { full, bytes } = tarPath(e, env);
	const limit = env.config.maxPathLength;
	return `${lead}: ${Quote(full)} (${bytes} bytes). Tarballs are only required to store paths of up to ${limit} bytes and cannot store those of more than ${MaxTarPathLength} bytes, with restrictions including to ${limit} bytes for the final component.`;
};

function cranKnows(e: PackageEntry, env: Env): string {
	const known = env.config.cranKnownHidden.includes(base(e.relative)) || /^[.]Rbuildindex[.]/.test(e.relative) || /(inst\/doc\/\.Rinstignore|inst\/doc\/\.build\.timestamp|vignettes\/\.Rinstignore)$/.test(e.relative) || /^src.*\/[.]deps$/.test(e.relative);
	return env.config.cranPack ? ` CRAN-pack ${known ? 'knows' : 'does not know'} about this.` : '';
}
function newerThan(e: PackageEntry, env: Env): string | undefined {
	const t = e.stats?.mtimeMs;
	const same = env.docTimes.get(e.relative.slice('vignettes/'.length));
	return t === undefined || env.docTimes.size === 0 ? undefined
		: t > Math.max(...env.docTimes.values()) + TimeToleranceMs ? "all files in 'inst/doc'"
			: same !== undefined && t > same + TimeToleranceMs ? "the same file in 'inst/doc'" : undefined;
}
function shouldNotInstall(e: PackageEntry, env: Env): boolean {
	const name = base(e.relative);
	if(e.isDirectory) {
		return env.config.docDirsNotInstalled.includes(name);
	}
	const matched = ReusedDocExtensions.test(name) || /(Makefile|~$)/.test(name) || env.stemPdf?.test(name) === true;
	return !AlreadyInR.includes(name) && (matched && !env.sources.has(name) || /^fig.*[.]pdf$/.test(name));
}
function installDir(rel: string): string | undefined {
	const parts = rel.split('/');
	return parts.length === 1 ? ['DESCRIPTION', 'NAMESPACE', 'NEWS', 'NEWS.md', 'INDEX', 'LICENSE', 'LICENCE'].includes(rel) ? '' : undefined
		: ['R', 'data', 'demo', 'exec', 'po'].includes(parts[0]) ? parts[0]
			: parts[0] === 'man' ? 'help' : parts[0] === 'inst' ? parts.length === 2 ? '' : parts[1] : undefined;
}

function installedSize(env: Env): string | undefined {
	const sizes = new Map<string, number>();
	let total = 0;
	for(const f of env.files) {
		const dir = installDir(f.relative);
		if(dir !== undefined) {
			total += env.size(f);
			sizes.set(dir, (sizes.get(dir) ?? 0) + env.size(f));
		}
	}
	const big = [...sizes].filter(([d, s]) => d !== '' && s >= Mb).sort(([a], [b]) => a.localeCompare(b));
	return total / Mb > env.config.maxInstalledSizeMb
		? `Installed size is about ${(total / Mb).toFixed(1)}Mb${big.length > 0 ? `; sub-directories of 1Mb or more: ${big.map(([d, s]) => `${d} ${(s / Mb).toFixed(1)}Mb`).join(', ')}` : ''}.` : undefined;
}

interface EntryRule {
	readonly kind:       PackageStructureKind
	readonly applies:    (e: PackageEntry, env: Env) => boolean
	readonly message:    (e: PackageEntry, env: Env) => string
	readonly certainty?: LintingResultCertainty
}

/** the directories that must not be empty: the kind, the directory, whether it holds something, and the message */
const NonEmptyDirs: readonly (readonly [PackageStructureKind, string, (env: Env) => boolean, string])[] = [
	['empty-r-directory', 'R', env => codeFiles(env).length > 0 || env.kinds.has('R/sysdata.rda'), "Found directory 'R' with no source files."],
	['empty-data-directory', 'data', env => env.children('data').some(e => !e.isDirectory && DataFile.test(e.relative)), "Subdirectory 'data' contains no data sets."],
	['empty-demo-directory', 'demo', env => env.demos.length > 0, "Subdirectory 'demo' contains no demos."],
	['empty-exec-directory', 'exec', env => env.children('exec').some(e => !base(e.relative).startsWith('.')), "Subdirectory 'exec' contains no files."],
	['empty-inst-directory', 'inst', env => env.files.some(f => f.relative.startsWith('inst/')), "Subdirectory 'inst' contains no files."],
	['empty-src-directory', 'src', env => ['Makefile', 'Makefile.win', 'Makefile.ucrt', 'install.libs.R'].some(m => env.kinds.has(`src/${m}`)) || env.children('src').some(e => /\.([cfmM]|cc|cpp|f90|f95|mm)/.test(base(e.relative))), "Subdirectory 'src' contains no source files."],
	['empty-tests-directory', 'tests', env => env.children('tests').some(e => !e.isDirectory && /\.(R|r|Rin)$/.test(e.relative)), "Directory 'tests' contains no test files (.R, .r or .Rin)."]
];

/** the files each of `R`, `man`, and `demo` accepts by name */
const AcceptedNames: Readonly<Record<string, (name: string, env: Env) => boolean>> = {
	R:    n => ['sysdata.rda', 'Makefile.win', 'Makefile.ucrt'].includes(n) || n.endsWith('.in') || CodeExtensions.has(ext(n)) && alnumStart(n),
	man:  n => ['Rd', 'rd'].includes(ext(n)) && alnumStart(n),
	demo: (n, env) => n === '00Index' || env.demos.some(d => d === n || `${d.replace(/r$/, 'R')}out.save` === n)
};
const SubdirFile = /^(?:(R|man)\/(?:(?:unix|windows)\/)?|(demo)\/)[^/]+$/;
const invalidVignetteName = (e: PackageEntry, env: Env) => parent(e) === 'inst/doc' && !ValidVignetteName.test(base(e.relative))
	&& (VignettePattern.test(e.relative) || /\.(pdf|html)$/.test(e.relative) && env.sources.has(base(e.relative).replace(/\.[^.]+$/, '')));
function wrongName(e: PackageEntry, env: Env): readonly [string, string] | undefined {
	const dir = SubdirFile.exec(e.relative)?.slice(1).find(d => d !== undefined);
	return e.isDirectory ? undefined : dir !== undefined && !AcceptedNames[dir](e.relative.slice(dir.length + 1), env) ? [dir, e.relative.slice(dir.length + 1)]
		: invalidVignetteName(e, env) ? ['inst/doc', base(e.relative)] : undefined;
}
const looseFile = (e: PackageEntry) => !e.isDirectory && LooseDirs.includes(parent(e));
const leftover = (e: PackageEntry, env: Env) => looseFile(e) && (new RegExp(`[.](${env.config.leftoverExtensions.join('|')})$`, 'i').test(e.relative) || parent(e) === 'vignettes' && ['Rplots.ps', 'Rplots.pdf'].includes(base(e.relative)));
const licensed = (e: PackageEntry, env: Env) => !e.isDirectory && LooseDirs.some(d => under(e, d)) && /[.](cls|sty|drv)$/.test(e.relative) && !ShippedStyles.includes(base(e.relative))
	&& LicenseNotice.every(l => (env.pf.read(e.relative) ?? '').includes(l));
const unmentionedLicense = (e: PackageEntry, env: Env) => ['LICENCE', 'LICENSE'].includes(base(e.relative)) && ['.', 'inst'].includes(parent(e)) && env.license !== '' && !env.license.includes(base(e.relative));
const nonStandard = (e: PackageEntry, env: Env) => env.config.checkTopLevel && isTop(e) && !e.relative.startsWith('.') && !env.config.standardTopLevel.includes(e.relative)
	&& !(['AUTHORS', 'COPYRIGHTS'].includes(e.relative) && env.kinds.has(`inst/${e.relative}`));
const executable = (e: PackageEntry, env: Env) => !e.isDirectory && e.stats !== undefined && !e.stats.isSymbolicLink() && !env.binary.has(e.relative) && !/\.(exe|dll)$/.test(e.relative) && isNativeExecutable(e.absolute, e.stats.mode);
/** like `R CMD check`, judge permissions only where the file system has them */
const PosixModes = getPlatform() !== 'windows';
const insufficient = (e: PackageEntry, env: Env) => {
	const mode = e.stats?.mode;
	return PosixModes && mode !== undefined && !e.stats?.isSymbolicLink() && (e.isDirectory ? (mode & 0o700) !== 0o700 && env.files.some(f => under(f, e.relative)) : (mode & 0o400) !== 0o400);
};

const EntryRules: readonly EntryRule[] = [
	{ kind: 'non-portable-file-name', applies: nonPortable, message: e => `Found the following file with a non-portable file name: ${Quote(e.relative)}. This is not a valid file name on all R platforms; please rename the file.` },
	{ kind: 'duplicate-lowercase-name', applies: (e, env) => env.firstByLower.get(e.relative.toLowerCase()) !== e.relative, message: (e, env) => `Found the following file with a duplicate lower-cased file name: ${Quote(e.relative)} (clashing with ${Quote(env.firstByLower.get(e.relative.toLowerCase()) ?? '')}). File names must not differ just by case to be usable on all R platforms.` },
	{ kind: 'not-fully-portable-name', applies: e => !nonPortable(e) && PortableNameChars.test(base(e.relative)), message: e => `Found the following file with a non-portable file name: ${Quote(e.relative)}. This is not a fully portable file name.` },
	{ kind: 'long-path', applies: (e, env) => tarPath(e, env).bytes > env.config.maxPathLength && tarPath(e, env).storable, message: (e, env) => pathNote(e, env, 'Found the following non-portable file path') },
	{ kind: 'unstorable-path', applies: (e, env) => tarPath(e, env).bytes > env.config.maxPathLength && !tarPath(e, env).storable, message: (e, env) => pathNote(e, env, 'Found the following file path that cannot be stored in a tarball') },
	{ kind: 'hidden-file', applies: (e, env) => base(e.relative).startsWith('.') && !env.config.hiddenAllowed.includes(e.relative), message: (e, env) => `Found the following hidden ${what(e)}: ${Quote(e.relative)}. These were most likely included in error.${cranKnows(e, env)}` },
	{ kind: 'defunct-top-level-file', applies: topFile('install.R', 'R_PROFILE.R'), message: e => `Found the defunct file ${Quote(e.relative)}. These files are defunct, see the manual 'Writing R Extensions'.` },
	{ kind: 'configure-without-source', applies: (e, env) => e.relative === 'configure' && generated(env) && !env.kinds.has('configure.ac') && !env.kinds.has('configure.in'), message: (_, env) => `Found a 'configure' file without source file 'configure.ac' or 'configure.in'. ${env.foss ? 'An Open Source package must include its autoconf sources.' : 'It is good practice to include autoconf sources.'}` },
	{ kind: 'configure-in', applies: (e, env) => e.relative === 'configure.in' && generated(env), message: () => "Found a 'configure.in' file: 'configure.ac' has long been preferred." },
	{ kind: 'bashism', applies: (e, env) => env.config.checkBashisms && topFile('configure', 'cleanup')(e) && bashism(e, env) !== undefined, message: (e, env) => `${Quote(e.relative)}: ${bashism(e, env)}` },
	{ kind: 'unmentioned-license-file', applies: unmentionedLicense, message: e => `File ${Quote(e.relative)} ${isTop(e) ? '' : 'will install at top-level and '}is not mentioned in the DESCRIPTION file.` },
	{ kind: 'non-standard-top-level', applies: nonStandard, message: e => `Non-standard ${what(e)} found at top level: ${Quote(e.relative)}${/^copyright/i.test(e.relative) ? '. Copyright information should be in file inst/COPYRIGHTS' : e.relative === 'AUTHORS' ? '. Authors information should be in file inst/AUTHORS' : ''}` },
	{ kind: 'leftover-file', applies: e => !e.isDirectory && (/svn-commit[.].*tmp$/.test(e.relative) || /^[^/]*[.][rR]d$/.test(e.relative)), message: (e, env) => `The file ${Quote(`${env.pkgName}/${e.relative}`)} looks like a leftover. Please remove it from your package.` },
	...NonEmptyDirs.map(([kind, dir, nonEmpty, message]): EntryRule => ({ kind, applies: (e, env) => e.isDirectory && e.relative === dir && !nonEmpty(env), message: () => message })),
	{ kind: 'case-variant-directory', applies: e => e.isDirectory && CaseVariants.has(e.relative), message: e => `Found subdirectory ${Quote(e.relative)}. Most likely, this should be ${Quote(CaseVariants.get(e.relative) ?? '')}.` },
	{ kind: 'rd2pdf-directory', applies: e => e.isDirectory && /^\.Rd2(dvi|pdf)/.test(base(e.relative)), message: e => `Found the following directory with the name of a Rd2pdf directory: ${Quote(e.relative)}. Most likely, this was included erroneously.` },
	{ kind: 'invalid-file-name', applies: (e, env) => wrongName(e, env) !== undefined, message: (e, env) => `Subdirectory ${Quote(wrongName(e, env)?.[0] ?? '')} contains invalid file names: ${Quote(wrongName(e, env)?.[1] ?? '')}. Please remove or rename the files.` },
	{ kind: 'demo-non-ascii', applies: (e, env) => parent(e) === 'demo' && env.demos.includes(base(e.relative)) && /[\u0080-￿]/.test(env.pf.read(e.relative) ?? ''), message: e => `Demos with non-ASCII characters: ${Quote(base(e.relative))}. Portable packages must use only ASCII characters in their demos; use \\uxxxx escapes for other characters.` },
	{ kind: 'inst-system-subdirectory', applies: (e, env) => e.isDirectory && parent(e) === 'inst' && env.config.reservedInstDirs.includes(base(e.relative)) && env.children(e.relative).length > 0, message: e => `Found the following non-empty subdirectory of 'inst' also used by R: ${Quote(e.relative)}. It is recommended not to interfere with package subdirectories used by R.` },
	{ kind: 'misplaced-citation', applies: e => !e.isDirectory && /^CITATION(\.[^.]*)?$/.test(base(e.relative)) && e.relative !== 'inst/CITATION', message: e => `Found the following CITATION file in a non-standard place: ${Quote(e.relative)}. Most likely 'inst/CITATION' should be used instead.` },
	{ kind: 'exe-dll-file', applies: (e, env) => !e.isDirectory && !env.binary.has(e.relative) && /\.(exe|dll)$/.test(e.relative), message: e => `Found the following executable file: ${Quote(e.relative)}. Source packages should not contain undeclared executable files.` },
	{ kind: 'executable-file', applies: executable, message: e => `Found the following executable file: ${Quote(e.relative)}. Source packages should not contain undeclared executable files.` },
	{ kind: 'insufficient-permissions', applies: insufficient, message: e => `Found the following ${what(e)} with insufficient permissions: ${Quote(e.relative)}. Permissions should be at least 700 for directories and 400 for files.` },
	{ kind: 'not-executable', applies: e => PosixModes && topFile('configure', 'cleanup')(e) && e.stats !== undefined && (e.stats.mode & 0o500) !== 0o500, message: e => `The file ${Quote(e.relative)} should most likely be executable (for the owner). Please fix its permissions.` },
	{ kind: 'future-timestamp', applies: (e, env) => env.config.checkFutureTimestamps && (e.stats?.mtimeMs ?? 0) > Date.now() + FutureLeewayMs, message: e => `Found the following ${what(e)} with a future time stamp: ${Quote(e.relative)}` },
	{ kind: 'crlf-shell-script', applies: (e, env) => topFile('configure', 'configure.in', 'configure.ac', 'cleanup')(e) && env.pf.read(e.relative)?.includes('\r') === true, message: e => `Found the shell script ${Quote(e.relative)} with CR or CRLF line endings. Non-Windows OSes require LF line endings.` },
	{ kind: 'vignette-source-missing', applies: (e, env) => parent(e) === 'inst/doc' && !e.isDirectory && SweavePattern.test(e.relative) && isDir(env, 'vignettes') && !env.kinds.has(`vignettes/${base(e.relative)}`), message: e => `Vignette source ${Quote(e.relative)} in 'inst/doc' missing from the 'vignettes' directory.` },
	{ kind: 'vignette-newer', applies: (e, env) => env.config.builtPackage && !e.isDirectory && under(e, 'vignettes') && newerThan(e, env) !== undefined, message: (e, env) => `The file ${Quote(e.relative)} in the 'vignettes' directory is newer than ${newerThan(e, env)}.` },
	{ kind: 'file-already-in-r', applies: e => looseFile(e) && AlreadyInR.includes(base(e.relative)), message: e => `The file ${Quote(base(e.relative))} is already in R. Please remove it from your package.` },
	{ kind: 'license-requires-sources', applies: licensed, message: e => `The file ${Quote(base(e.relative))} contains a license that requires distribution of original sources. Please ensure that you have complied with it.` },
	{ kind: 'leftover-mistake', applies: leftover, message: e => `The file ${Quote(base(e.relative))} looks like a leftover/mistake. Please remove it from your package.` },
	{ kind: 'knitr-leftover', applies: e => e.isDirectory && parent(e) === 'vignettes' && ['cache', 'figure'].includes(base(e.relative)), message: e => `The directory ${Quote(base(e.relative))} looks like a leftover from 'knitr'. Please remove from your package.` },
	{ kind: 'should-not-install', applies: (e, env) => parent(e) === 'inst/doc' && shouldNotInstall(e, env), message: e => `The ${what(e)} ${Quote(base(e.relative))} should probably not be installed. Consider the use of a .Rinstignore file, or move the vignette sources from 'inst/doc' to 'vignettes'.` },
	{ kind: 'large-pdf', applies: (e, env) => under(e, 'inst/doc') && /\.pdf/.test(base(e.relative)) && e.relative !== 'inst/doc/Rplots.pdf' && env.size(e) > env.config.maxPdfBytes, certainty: LintingResultCertainty.Uncertain, message: (e, env) => `The PDF file ${Quote(e.relative)} is ${(env.size(e) / Mb).toFixed(1)}Mb, consider running tools::compactPDF() on it, or build the source package with --compact-vignettes.` }
];

/** checks of the package as a whole: a rule holds if `check` answers a message */
type PackageRule = { readonly kind: PackageStructureKind, readonly file: string, readonly check: (env: Env) => string | undefined, readonly certainty?: LintingResultCertainty };
const PackageRules: readonly PackageRule[] = [
	{ kind:  'vignettes-without-inst-doc', file:  'vignettes', check: env => env.config.builtPackage && isDir(env, 'vignettes') && env.files.some(f => f.relative.startsWith('vignettes/')) && !env.files.some(f => f.relative.startsWith('inst/doc/'))
		? "Files in the 'vignettes' directory but no files in 'inst/doc'." : undefined },
	{ kind:  'no-vignette-builder', file:  'DESCRIPTION', check: env => {
		const top = env.children('vignettes').filter(e => !base(e.relative).startsWith('.'));
		return top.length > 0 && !top.some(e => SweavePattern.test(e.relative)) && !/^VignetteBuilder:/m.test(env.pf.read('DESCRIPTION') ?? '')
			? 'Package has no Sweave vignette sources and no VignetteBuilder field.' : undefined;
	} },
	...['Rplots.ps', 'Rplots.pdf'].map((name): PackageRule => ({ kind: 'vignette-leftover', file: `inst/doc/${name}`, check: env => env.kinds.has(`inst/doc/${name}`) || env.pf.onDisk && fs.existsSync(path.join(env.pf.root, `inst/doc/${name}`)) ? `The file ${Quote(`inst/doc/${name}`)} will not be installed: please remove it.` : undefined })),
	{ kind: 'installed-size', file: 'DESCRIPTION', check: env => env.pf.onDisk ? installedSize(env) : undefined, certainty: LintingResultCertainty.Uncertain }
];

/** the entries of `build/vignette.rds` that name files missing from the package */
function buildFindings(env: Env): [PackageStructureKind, string][] {
	const index = env.pf.onDisk && env.kinds.has('build/vignette.rds') ? readVignetteIndex(path.join(env.pf.root, 'build/vignette.rds')) : undefined;
	const col = (n: string) => index?.get(n) ?? [];
	const missing = (kind: PackageStructureKind, what: string, name: string): [PackageStructureKind, string][] => name !== '' && !env.kinds.has(`inst/doc/${name}`)
		? [[kind, `${what} listed in 'build/vignette.rds' but not in package: ${Quote(`inst/doc/${name}`)}`]] : [];
	return col('File').flatMap((file, i) => (col('PDF')[i] ?? '') === ''
		? [['build-vignette-without-output', `Vignette without any output listed in 'build/vignette.rds': ${Quote(file)}`] as [PackageStructureKind, string]]
		: [...missing('build-missing-output', 'Output', col('PDF')[i]), ...missing('build-missing-source', 'Source', file), ...missing('build-missing-code', 'R code', col('R')[i] ?? '')]);
}

/** Port of the file and directory structure checks of `R CMD check` (portable names, hidden and top-level files, subdirectories, permissions, sizes, vignettes). */
export const PACKAGE_STRUCTURE = {
	createSearch:        () => Q.from([]),
	processSearchResult: onPackageFiles({ inspectedEntries: 0, onDisk: false }, (pf, pkg, config) => {
		const found = fileFindings<PackageStructureKind>(pf);
		const entries = pf.entries;
		const byParent = new Map<string, PackageEntry[]>();
		const firstByLower = new Map<string, string>();
		for(const e of entries) {
			byParent.set(path.posix.dirname(e.relative), [...byParent.get(path.posix.dirname(e.relative)) ?? [], e]);
			const first = firstByLower.get(e.relative.toLowerCase());
			if(first === undefined || e.relative < first) {
				firstByLower.set(e.relative.toLowerCase(), e.relative);
			}
		}
		const children = (dir: string) => byParent.get(dir) ?? [];
		const files = entries.filter(isFile);
		const sources = new Set(children('inst/doc').filter(e => !e.isDirectory && VignettePattern.test(e.relative)).map(e => base(e.relative)));
		const stems = [...sources].map(s => s.replace(/\.[^.]+$/, ''));
		const description = pkg.description?.content();
		const license = (description?.get('License') ?? []).join(' ');
		const flag = description?.get('License_is_FOSS')?.[0]?.trim().toLowerCase();
		const env: Env = {
			pf, config, files, children, firstByLower, sources,
			pkgName:  pkg.name ?? path.basename(pf.root),
			license,
			foss:     flag === 'yes' || flag === 'no' ? flag === 'yes' : FosLicense.test(license) && !LimitedLicense.test(license),
			kinds:    new Map(entries.map(e => [e.relative, e.isDirectory])),
			size:     e => e.stats?.size ?? Buffer.byteLength(pf.read(e.relative) ?? ''),
			binary:   new Set((pf.read('BinaryFiles') ?? '').split(/\r?\n/).filter(l => l !== '')),
			demos:    children('demo').filter(e => !e.isDirectory && ['R', 'r'].includes(ext(e.relative)) && /^[A-Za-z]/.test(base(e.relative))).map(e => base(e.relative)),
			stemPdf:  stems.length > 0 ? new RegExp(`^(${stems.map(s => escapeRegex(s)).join('|')})-[0-9]+[.]pdf`) : undefined,
			docTimes: new Map(files.filter(f => f.relative.startsWith('inst/doc/')).map(f => [f.relative.slice('inst/doc/'.length), f.stats?.mtimeMs ?? 0]))
		};
		for(const rule of EntryRules) {
			entries.filter(e => rule.applies(e, env)).forEach(e => found.add(rule.kind, e.relative, rule.message(e, env), undefined, rule.certainty));
		}
		for(const rule of PackageRules) {
			const message = rule.check(env);
			if(message !== undefined) {
				found.add(rule.kind, rule.file, message, undefined, rule.certainty);
			}
		}
		buildFindings(env).forEach(([kind, message]) => found.add(kind, 'build/vignette.rds', message));
		return { results: found.results, '.meta': { inspectedEntries: entries.length, onDisk: pf.onDisk } };
	}),
	prettyPrint: MessageAtLocation,
	info:        {
		name:          'Package Structure',
		tags:          [LintingRuleTag.CmdCheck], certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds problems in the package files: portable names, hidden files, top-level files, subdirectories, permissions, executables, timestamps, sizes, line endings of scripts, and vignette leftovers.',
		defaultConfig: () => ({
			maxPathLength:         100,
			hiddenAllowed:         ['.Rbuildignore', '.Rinstignore', 'vignettes/.install_extras', '.aspell'],
			cranKnownHidden:       ['.Renviron', '.Rprofile', '.Rproj.user', '.Rhistory', '.Rapp.history', '.tex', '.log', '.aux', '.pdf', '.png', '.backups', '.cvsignore', '.cproject', '.directory', '.dropbox', '.exrc', '.gdb.history', '.gitattributes', '.gitignore', '.gitmodules', '.hgignore', '.hgtags', '.project', '.seed', '.settings', '.tm_properties'],
			cranPack:              true,
			checkTopLevel:         true,
			standardTopLevel:      ['DESCRIPTION', 'INDEX', 'LICENCE', 'LICENSE', 'LICENCE.note', 'LICENSE.note', 'MD5', 'NAMESPACE', 'NEWS', 'PORTING', 'COPYING', 'COPYING.LIB', 'GPL-2', 'GPL-3', 'BUGS', 'Bugs', 'ChangeLog', 'Changelog', 'CHANGELOG', 'CHANGES', 'Changes', 'INSTALL', 'README', 'THANKS', 'TODO', 'ToDo', 'SHA256', 'SHA256.sig', 'INSTALL.windows', 'README.md', 'NEWS.md', 'configure', 'configure.win', 'cleanup', 'cleanup.win', 'configure.ucrt', 'cleanup.ucrt', 'configure.ac', 'configure.in', 'datafiles', 'R', 'data', 'demo', 'exec', 'inst', 'man', 'po', 'src', 'tests', 'vignettes', 'build', '.aspell', 'upstream', 'java', 'tools', 'noweb'],
			checkBashisms:         false,
			reservedInstDirs:      ['Meta', 'R', 'data', 'demo', 'exec', 'libs', 'man', 'help', 'html', 'latex', 'R-ex', 'build'],
			maxInstalledSizeMb:    5,
			maxPdfBytes:           Mb,
			checkFutureTimestamps: true,
			builtPackage:          false,
			leftoverExtensions:    ['log', 'aux', 'bbl', 'blg', 'dvi', 'toc', 'out', 'Rd', 'Rout', 'dbj', 'drv', 'ins'],
			docDirsNotInstalled:   ['auto', 'Bilder', 'fig', 'figs', 'figures', 'Figures', 'img', 'images', 'JSSstyle', 'jssStyle', 'screenshots2', 'src', 'tex', 'tmp']
		})
	}
} as const satisfies LintingRule<PackageStructureResult, PackageStructureMetadata, PackageStructureConfig>;
