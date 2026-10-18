import fs from 'fs';
import path from 'path';
import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { FlowrInlineTextFile } from '../../../project/context/flowr-file';
import { RDAParser, type RObject, type RObjectData } from '../../../project/plugins/file-plugins/files/flowr-rda-file';
import { escapeRegex } from '../../../util/text/strings';
import { type CmdCheckResult, packageInfo } from './cmd-check-util';
import { type PackageEntry, type PackageFiles, packageFiles } from './package-files';

export type PackageStructureKind =
	| 'non-portable-file-name' | 'duplicate-lowercase-name' | 'not-fully-portable-name' | 'long-path' | 'unstorable-path'
	| 'hidden-file' | 'defunct-top-level-file' | 'configure-without-source' | 'configure-in' | 'bashism' | 'unmentioned-license-file' | 'non-standard-top-level' | 'leftover-file'
	| 'empty-r-directory' | 'case-variant-directory' | 'rd2pdf-directory' | 'invalid-file-name' | 'empty-data-directory' | 'empty-demo-directory' | 'demo-non-ascii'
	| 'empty-exec-directory' | 'empty-inst-directory' | 'empty-src-directory' | 'inst-system-subdirectory' | 'misplaced-citation' | 'empty-tests-directory'
	| 'build-vignette-without-output' | 'build-missing-output' | 'build-missing-source' | 'build-missing-code'
	| 'exe-dll-file' | 'executable-file' | 'insufficient-permissions' | 'not-executable' | 'future-timestamp' | 'installed-size'
	| 'large-pdf' | 'crlf-shell-script' | 'vignette-leftover' | 'vignette-source-missing' | 'vignettes-without-inst-doc' | 'vignette-newer'
	| 'no-vignette-builder' | 'file-already-in-r' | 'license-requires-sources' | 'leftover-mistake' | 'knitr-leftover' | 'should-not-install';

export interface PackageStructureResult extends CmdCheckResult {
	/** the sub-check of `R CMD check` the finding stems from */
	readonly kind: PackageStructureKind
	/** the offending file or directory, relative to the package root (`DESCRIPTION` for package-level findings) */
	readonly file: string
}

export interface PackageStructureConfig extends MergeableRecord {
	/** a path of more than this many bytes (with the package name as prefix) is noted (default `100`) */
	readonly maxPathLength:         number
	/** a path of more than this many bytes cannot be stored in a tarball (default `256`) */
	readonly maxTarPathLength:      number
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
	/** the size in Mb a sub-directory of the installation is listed from (default `1`) */
	readonly maxSubdirSizeMb:       number
	/** a PDF in `inst/doc` of more bytes than this is flagged to be compacted (default 1 MiB) */
	readonly maxPdfBytes:           number
	/** whether to flag files and directories modified in the future (`R CMD check` does with `--as-cran`) */
	readonly checkFutureTimestamps: boolean
	/** how many seconds a modification time may be in the future (default `300`) */
	readonly futureLeewaySeconds:   number
	/** how many seconds a vignette may be newer than its build in `inst/doc` (default `10`) */
	readonly fileTimeTolerance:     number
	/** whether the package is a built tarball (so `inst/doc` is expected to hold the vignette outputs) */
	readonly builtPackage:          boolean
	/** the extensions (without dot) of files that are leftovers when found next to vignettes */
	readonly leftoverExtensions:    readonly string[]
	/** files that ship with R, which a package should not carry in `vignettes` or `inst/doc` */
	readonly filesAlreadyInR:       readonly string[]
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
const isControl = (c: string) => /\p{Cc}/u.test(c);
const ReservedNames = /^(con|prn|aux|clock[$]|nul|lpt[1-9]|com[1-9])$/;
const CodeExtensions = new Set(['R', 'r', 'S', 's', 'q']);
const DataExtensions = /\.(R|r|RData|rdata|rda|tab|txt|TXT|csv|CSV)(\.(gz|bz2|xz))?$/;
const SweavePattern = /\.[RrSs](nw|tex)$/;
const VignettePattern = /\.([RrSs](nw|tex)|Rmd|rmd|qmd|Rmarkdown|rmarkdown)$/;
const ValidVignetteName = /^[A-Za-z][A-Za-z0-9._-]+$/;
const OsDirectories = ['unix', 'windows'];
const ReusedDocExtensions = /\.(tex|lyx|png|jpg|jpeg|gif|ico|bst|cls|sty|ps|eps|img)$/i;
const LicenseNotice = [
	'%% This generated file may be distributed as long as the',
	'%% original source files, as listed above, are part of the',
	'%% same distribution.'
];
const FosLicense = /\b(GPL|LGPL|AGPL|MIT|BSD|Apache|Artistic|MPL|Mozilla|CC0|CC BY|EUPL|CeCILL|Boost|EPL|Eclipse|CPL|zlib|GNU)/i;
const LimitedLicense = /non-?commercial|\bNC\b|restricts|academic/i;
const Quote = (s: string) => `'${s}'`;
const Kb = 1024;
const HiddenDirectoryExclusion = /^src.*\/[.]deps$/;

function isHexMagic(buf: Buffer, ...bytes: number[]): boolean {
	return bytes.every((b, i) => buf[i] === b);
}

/** whether the leading bytes are those of a native executable (ELF, PE, Mach-O), as `file` would call it one */
function isNativeExecutable(file: string, mode: number): boolean {
	let fd: number | undefined;
	try {
		fd = fs.openSync(file, 'r');
		const buf = Buffer.alloc(20);
		const n = fs.readSync(fd, buf, 0, 20, 0);
		if(n < 20) {
			return n >= 2 && isHexMagic(buf, 0x4d, 0x5a);
		}
		if(isHexMagic(buf, 0x7f, 0x45, 0x4c, 0x46)) {
			const type = buf[5] === 2 ? buf.readUInt16BE(16) : buf.readUInt16LE(16);
			return type === 2 || type === 3 && (mode & 0o111) !== 0 && !/\.so(\.|$)/.test(file);
		}
		if(isHexMagic(buf, 0x4d, 0x5a)) {
			return true;
		}
		if(isHexMagic(buf, 0xfe, 0xed, 0xfa, 0xce) || isHexMagic(buf, 0xfe, 0xed, 0xfa, 0xcf)) {
			return buf.readUInt32BE(12) === 2;
		}
		if(isHexMagic(buf, 0xce, 0xfa, 0xed, 0xfe) || isHexMagic(buf, 0xcf, 0xfa, 0xed, 0xfe)) {
			return buf.readUInt32LE(12) === 2;
		}
		return false;
	} catch{
		return false;
	} finally {
		if(fd !== undefined) {
			fs.closeSync(fd);
		}
	}
}

/** the string columns of the data frame a serialized `build/vignette.rds` holds */
function readVignetteIndex(file: string): ReadonlyMap<string, readonly string[]> | undefined {
	try {
		const obj = new RDAParser(new FlowrInlineTextFile(file, ''), false).parseObject() as RObjectData;
		const columns = Array.isArray(obj.value) ? obj.value as RObjectData[] : [];
		let names: string[] = [];
		for(let a: RObject | undefined = obj.attributes?.[0]; a !== undefined && typeof a === 'object'; a = a.cdr) {
			const tag = a.tag;
			if(typeof tag === 'object' && tag.name === 'names' && typeof a.car === 'object' && Array.isArray(a.car.value)) {
				names = a.car.value as string[];
			}
		}
		return new Map(names.map((n, i) => [n, (Array.isArray(columns[i]?.value) ? columns[i].value : []) as string[]]));
	} catch{
		return undefined;
	}
}

class Collector {
	public readonly results: PackageStructureResult[] = [];
	constructor(private readonly pf: PackageFiles) {}

	public add(kind: PackageStructureKind, message: string, file: string, certainty = LintingResultCertainty.Certain, line?: number): void {
		this.results.push({ certainty, involvedId: undefined, loc: this.pf.locate(file, line), kind, file, message });
	}
}

interface Env {
	readonly pf:       PackageFiles
	readonly out:      Collector
	readonly config:   PackageStructureConfig
	readonly pkgName:  string
	readonly license:  readonly string[]
	readonly fossFlag: string | undefined
	readonly has:      (relative: string) => boolean
	readonly files:    readonly PackageEntry[]
	readonly dirs:     readonly PackageEntry[]
	/** the direct children of a directory (`.` for the root) */
	readonly children: (dir: string) => readonly PackageEntry[]
	readonly size:     (e: PackageEntry) => number
}

const base = (p: string) => path.posix.basename(p);
const ext = (p: string) => path.posix.extname(p).slice(1);

/** `tools::list_files_with_type(dir, "code")`: the code files of `R`, including those in the OS folders */
function codeFiles(env: Env): PackageEntry[] {
	return [...env.children('R'), ...OsDirectories.flatMap(os => env.children(`R/${os}`))]
		.filter(e => !e.isDirectory && CodeExtensions.has(ext(e.relative)) && /^[A-Za-z0-9]/.test(base(e.relative)));
}

/** checking for portable file names */
function checkFileNames(env: Env): void {
	const { out, config, pkgName } = env;
	const withFiles = new Set(env.files.map(f => path.posix.dirname(f.relative)).filter(d => d !== '.').flatMap(d => {
		const parts = d.split('/');
		return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
	}));
	const all = [...env.files.map(f => f.relative), ...withFiles].sort();
	const bad = new Set<string>();
	for(const f of all) {
		const b = base(f);
		const inMan = path.posix.dirname(f).endsWith('man');
		if(InvalidNameChars.test(b) || [...b].some(isControl) || inMan && /[^ -~]|%/.test(b) || ReservedNames.test(b.toLowerCase().replace(/[.].*/, ''))) {
			bad.add(f);
			out.add('non-portable-file-name', `Found the following file with a non-portable file name: ${Quote(f)}. This is not a valid file name on all R platforms; please rename the file.`, f);
		}
	}
	const seen = new Map<string, string>();
	for(const f of all) {
		const lower = f.toLowerCase();
		const first = seen.get(lower);
		if(first === undefined) {
			seen.set(lower, f);
		} else {
			out.add('duplicate-lowercase-name', `Found the following file with a duplicate lower-cased file name: ${Quote(f)} (clashing with ${Quote(first)}). File names must not differ just by case to be usable on all R platforms.`, f);
		}
	}
	for(const f of all) {
		if(!bad.has(f) && PortableNameChars.test(base(f))) {
			out.add('not-fully-portable-name', `Found the following file with a non-portable file name: ${Quote(f)}. This is not a fully portable file name.`, f);
		}
	}
	for(const f of all) {
		const full = `${pkgName}/${f}`;
		const bytes = Buffer.byteLength(full);
		if(bytes <= config.maxPathLength) {
			continue;
		}
		const raw = Buffer.from(full);
		const slash = raw.subarray(0, 155).lastIndexOf('/');
		if(bytes > config.maxTarPathLength || slash < 0 || slash + 100 < raw.length) {
			out.add('unstorable-path', `Found the following file path that cannot be stored in a tarball: ${Quote(full)} (${bytes} bytes). Tarballs are only required to store paths of up to ${config.maxPathLength} bytes and cannot store those of more than ${config.maxTarPathLength} bytes, with restrictions including to ${config.maxPathLength} bytes for the final component.`, f);
		} else {
			out.add('long-path', `Found the following non-portable file path: ${Quote(full)} (${bytes} bytes). Tarballs are only required to store paths of up to ${config.maxPathLength} bytes and cannot store those of more than ${config.maxTarPathLength} bytes, with restrictions including to ${config.maxPathLength} bytes for the final component.`, f);
		}
	}
}

/** checking for hidden files and directories */
function checkHidden(env: Env): void {
	const { out, config } = env;
	const allowed = new Set(config.hiddenAllowed);
	const known = new Set(config.cranKnownHidden);
	for(const e of env.pf.entries) {
		const b = base(e.relative);
		if(!b.startsWith('.') || allowed.has(e.relative)) {
			continue;
		}
		let message = `Found the following hidden ${e.isDirectory ? 'directory' : 'file'}: ${Quote(e.relative)}. These were most likely included in error.`;
		if(config.cranPack) {
			const inKnown = known.has(b) || /^[.]Rbuildindex[.]/.test(e.relative) || e.relative.endsWith('inst/doc/.Rinstignore') || e.relative.endsWith('inst/doc/.build.timestamp')
				|| e.relative.endsWith('vignettes/.Rinstignore') || HiddenDirectoryExclusion.test(e.relative);
			message += inKnown ? ' CRAN-pack knows about this.' : ' CRAN-pack does not know about this.';
		}
		out.add('hidden-file', message, e.relative);
	}
}

function isFoss(env: Env): boolean {
	const flag = env.fossFlag?.trim().toLowerCase();
	if(flag === 'yes' || flag === 'no') {
		return flag === 'yes';
	}
	const lic = env.license.join(' ');
	return FosLicense.test(lic) && !LimitedLicense.test(lic);
}

/** checking top-level files */
function checkTopLevel(env: Env): void {
	const { out, config, pf } = env;
	const top = env.children('.');
	for(const name of ['install.R', 'R_PROFILE.R']) {
		if(env.has(name)) {
			out.add('defunct-top-level-file', `Found the defunct file ${Quote(name)}. These files are defunct, see the manual 'Writing R Extensions'.`, name);
		}
	}
	const configure = pf.read('configure');
	if(configure !== undefined && /Generated by GNU Autoconf/i.test(configure)) {
		if(!env.has('configure.ac') && !env.has('configure.in')) {
			out.add('configure-without-source', isFoss(env)
				? "Found a 'configure' file without source file 'configure.ac' or 'configure.in'. An Open Source package must include its autoconf sources."
				: "Found a 'configure' file without source file 'configure.ac' or 'configure.in'. It is good practice to include autoconf sources.", 'configure');
		} else if(env.has('configure.in')) {
			out.add('configure-in', "Found a 'configure.in' file: 'configure.ac' has long been preferred.", 'configure.in');
		}
	}
	if(config.checkBashisms) {
		for(const f of ['configure', 'cleanup']) {
			const first = pf.read(f)?.split(/\r?\n/, 1)[0] ?? '';
			if(/^#! *\/bin\/bash/.test(first)) {
				out.add('bashism', `${Quote(f)}: /bin/bash is not portable`, f);
			} else if(/^#!.*env bash/.test(first)) {
				out.add('bashism', `${Quote(f)}: 'env bash' is not portable as bash need not be installed`, f);
			}
		}
	}
	if(env.license.length > 0) {
		const lic = env.license.join(' ');
		for(const f of ['LICENCE', 'LICENSE']) {
			if(env.has(f) && !lic.includes(f)) {
				out.add('unmentioned-license-file', `File ${Quote(f)} is not mentioned in the DESCRIPTION file.`, f);
			}
			if(env.has(`inst/${f}`) && !lic.includes(f)) {
				out.add('unmentioned-license-file', `File ${Quote(`inst/${f}`)} will install at top-level and is not mentioned in the DESCRIPTION file.`, `inst/${f}`);
			}
		}
	}
	if(config.checkTopLevel) {
		const known = new Set(config.standardTopLevel);
		if(env.has('inst/AUTHORS')) {
			known.add('AUTHORS');
		}
		if(env.has('inst/COPYRIGHTS')) {
			known.add('COPYRIGHTS');
		}
		for(const e of top) {
			const name = e.relative;
			if(known.has(name) || name.startsWith('.')) {
				continue;
			}
			let message = `Non-standard ${e.isDirectory ? 'directory' : 'file'} found at top level: ${Quote(name)}`;
			if(/^copyright/i.test(name)) {
				message += '. Copyright information should be in file inst/COPYRIGHTS';
			} else if(name === 'AUTHORS') {
				message += '. Authors information should be in file inst/AUTHORS';
			}
			out.add('non-standard-top-level', message, name);
		}
	}
}

/** checking for left-over files */
function checkLeftovers(env: Env): void {
	for(const f of env.files) {
		if(/svn-commit[.].*tmp$/.test(f.relative) || /^[^/]*[.][rR]d$/.test(f.relative)) {
			env.out.add('leftover-file', `The file ${Quote(`${env.pkgName}/${f.relative}`)} looks like a leftover. Please remove it from your package.`, f.relative);
		}
	}
}

/** the files of a directory that `.check_package_subdirs` does not accept */
function wrongFiles(env: Env, dir: string, accepted: (name: string) => boolean): void {
	const candidates = [...env.children(dir), ...dir === 'R' || dir === 'man' ? OsDirectories.flatMap(os => env.children(`${dir}/${os}`)) : []];
	for(const f of candidates) {
		if(!f.isDirectory && !accepted(f.relative.slice(dir.length + 1))) {
			env.out.add('invalid-file-name', `Subdirectory ${Quote(dir)} contains invalid file names: ${Quote(f.relative.slice(dir.length + 1))}. Please remove or rename the files.`, f.relative);
		}
	}
}

const alnumStart = (name: string) => /^[A-Za-z0-9]/.test(base(name));

/** checking package subdirectories */
function checkSubdirectories(env: Env): void {
	const { out, pf, config } = env;
	const dirNames = new Set(env.dirs.map(d => d.relative));
	if(dirNames.has('R') && codeFiles(env).length === 0 && !env.has('R/sysdata.rda')) {
		out.add('empty-r-directory', "Found directory 'R' with no source files.", 'R');
	}
	for(const [wrong, right] of [['r', 'R'], ['MAN', 'man'], ['DATA', 'data']] as const) {
		if(dirNames.has(wrong)) {
			out.add('case-variant-directory', `Found subdirectory ${Quote(wrong)}. Most likely, this should be ${Quote(right)}.`, wrong);
		}
	}
	for(const d of env.dirs) {
		if(/^\.Rd2(dvi|pdf)/.test(base(d.relative))) {
			out.add('rd2pdf-directory', `Found the following directory with the name of a Rd2pdf directory: ${Quote(d.relative)}. Most likely, this was included erroneously.`, d.relative);
		}
	}
	wrongFiles(env, 'R', n => ['sysdata.rda', 'Makefile.win', 'Makefile.ucrt'].includes(n) || n.endsWith('.in') || CodeExtensions.has(ext(n)) && alnumStart(n));
	wrongFiles(env, 'man', n => ['Rd', 'rd'].includes(ext(n)) && alnumStart(n));
	const demos = env.children('demo').filter(e => !e.isDirectory && ['R', 'r'].includes(ext(e.relative)) && /^[A-Za-z]/.test(base(e.relative)));
	wrongFiles(env, 'demo', n => n === '00Index' || demos.some(d => base(d.relative) === n || `${base(d.relative).replace(/r$/, 'R')}out.save` === n));
	const vignettes = env.children('inst/doc').filter(e => !e.isDirectory && VignettePattern.test(e.relative));
	if(vignettes.length > 0) {
		const stems = new Set(vignettes.map(v => base(v.relative).replace(/\.[^.]+$/, '')));
		const outputs = env.children('inst/doc').filter(e => !e.isDirectory && /\.(pdf|html)$/.test(e.relative) && stems.has(base(e.relative).replace(/\.[^.]+$/, '')));
		for(const v of [...vignettes, ...outputs]) {
			if(!ValidVignetteName.test(base(v.relative))) {
				out.add('invalid-file-name', `Subdirectory 'inst/doc' contains invalid file names: ${Quote(base(v.relative))}. Please remove or rename the files.`, v.relative);
			}
		}
	}
	if(dirNames.has('data') && !env.children('data').some(e => !e.isDirectory && DataExtensions.test(e.relative))) {
		out.add('empty-data-directory', "Subdirectory 'data' contains no data sets.", 'data');
	}
	if(dirNames.has('demo')) {
		if(demos.length === 0) {
			out.add('empty-demo-directory', "Subdirectory 'demo' contains no demos.", 'demo');
		}
		for(const d of demos) {
			const text = pf.read(d.relative);
			if(text !== undefined && [...text].some(c => c.charCodeAt(0) > 127)) {
				out.add('demo-non-ascii', `Demos with non-ASCII characters: ${Quote(base(d.relative))}. Portable packages must use only ASCII characters in their demos; use \\uxxxx escapes for other characters.`, d.relative);
			}
		}
	}
	if(dirNames.has('exec') && !env.children('exec').some(e => !base(e.relative).startsWith('.'))) {
		out.add('empty-exec-directory', "Subdirectory 'exec' contains no files.", 'exec');
	}
	if(dirNames.has('inst') && !env.files.some(f => f.relative.startsWith('inst/'))) {
		out.add('empty-inst-directory', "Subdirectory 'inst' contains no files.", 'inst');
	}
	if(dirNames.has('src') && !['Makefile', 'Makefile.win', 'Makefile.ucrt', 'install.libs.R'].some(m => env.has(`src/${m}`))
		&& !env.children('src').some(e => /\.([cfmM]|cc|cpp|f90|f95|mm)/.test(base(e.relative)))) {
		out.add('empty-src-directory', "Subdirectory 'src' contains no source files.", 'src');
	}
	const reserved = new Set(config.reservedInstDirs);
	for(const d of env.children('inst')) {
		if(d.isDirectory && reserved.has(base(d.relative)) && env.children(d.relative).length > 0) {
			out.add('inst-system-subdirectory', `Found the following non-empty subdirectory of 'inst' also used by R: ${Quote(d.relative)}. It is recommended not to interfere with package subdirectories used by R.`, d.relative);
		}
	}
	for(const f of env.files) {
		const b = base(f.relative);
		if(b.startsWith('CITATION') && b.replace(/\.[^.]*$/, '') === 'CITATION' && f.relative !== 'inst/CITATION') {
			out.add('misplaced-citation', `Found the following CITATION file in a non-standard place: ${Quote(f.relative)}. Most likely 'inst/CITATION' should be used instead.`, f.relative);
		}
	}
	const tests = env.children('tests');
	if(dirNames.has('tests') && !tests.some(e => !e.isDirectory && /\.(R|r|Rin)$/.test(e.relative))) {
		out.add('empty-tests-directory', "Directory 'tests' contains no test files (.R, .r or .Rin).", 'tests');
	}
}

/** checking 'build' directory */
function checkBuild(env: Env): void {
	const { out, pf } = env;
	const rds = pf.entries.find(e => e.relative === 'build/vignette.rds');
	if(rds === undefined || !pf.onDisk) {
		return;
	}
	const index = readVignetteIndex(rds.absolute);
	const col = (n: string) => index?.get(n) ?? [];
	const pdfs = col('PDF');
	col('File').forEach((file, i) => {
		const output = pdfs[i] ?? '';
		if(output === '') {
			out.add('build-vignette-without-output', `Vignette without any output listed in 'build/vignette.rds': ${Quote(file)}`, rds.relative);
			return;
		}
		if(!env.has(`inst/doc/${output}`)) {
			out.add('build-missing-output', `Output listed in 'build/vignette.rds' but not in package: ${Quote(`inst/doc/${output}`)}`, rds.relative);
		}
		if(file !== '' && !env.has(`inst/doc/${file}`)) {
			out.add('build-missing-source', `Source listed in 'build/vignette.rds' but not in package: ${Quote(`inst/doc/${file}`)}`, rds.relative);
		}
		const code = col('R')[i] ?? '';
		if(code !== '' && !env.has(`inst/doc/${code}`)) {
			out.add('build-missing-code', `R code listed in 'build/vignette.rds' but not in package: ${Quote(`inst/doc/${code}`)}`, rds.relative);
		}
	});
}

/** checking for .dll and .exe files and for executable files */
function checkExecutables(env: Env): void {
	const { out, pf } = env;
	const excluded = new Set((pf.read('BinaryFiles') ?? '').split(/\r?\n/).filter(l => l !== ''));
	for(const f of env.files) {
		if(excluded.has(f.relative)) {
			continue;
		}
		if(/\.(exe|dll)$/.test(f.relative)) {
			out.add('exe-dll-file', `Found the following executable file: ${Quote(f.relative)}. Source packages should not contain undeclared executable files.`, f.relative);
		} else if(pf.onDisk && f.stats && !f.stats.isSymbolicLink() && isNativeExecutable(f.absolute, f.stats.mode)) {
			out.add('executable-file', `Found the following executable file: ${Quote(f.relative)}. Source packages should not contain undeclared executable files.`, f.relative);
		}
	}
}

/** checking for sufficient/correct file permissions and future file timestamps */
function checkFileSystem(env: Env): void {
	const { out, config } = env;
	for(const e of [...env.files, ...env.dirs.filter(d => env.files.some(f => f.relative.startsWith(`${d.relative}/`)))]) {
		const mode = e.stats?.mode;
		if(mode === undefined || e.stats?.isSymbolicLink()) {
			continue;
		}
		if(e.isDirectory ? (mode & 0o700) !== 0o700 : (mode & 0o400) !== 0o400) {
			out.add('insufficient-permissions', `Found the following ${e.isDirectory ? 'directory' : 'file'} with insufficient permissions: ${Quote(e.relative)}. Permissions should be at least 700 for directories and 400 for files.`, e.relative);
		}
	}
	for(const f of ['configure', 'cleanup']) {
		const mode = env.files.find(e => e.relative === f)?.stats?.mode;
		if(mode !== undefined && (mode & 0o500) !== 0o500) {
			out.add('not-executable', `The file ${Quote(f)} should most likely be executable (for the owner). Please fix its permissions.`, f);
		}
	}
	if(config.checkFutureTimestamps) {
		const limit = Date.now() + config.futureLeewaySeconds * 1000;
		for(const e of env.pf.entries) {
			if(e.stats !== undefined && e.stats.mtimeMs > limit) {
				out.add('future-timestamp', `Found the following ${e.isDirectory ? 'directory' : 'file'} with a future time stamp: ${Quote(e.relative)}`, e.relative);
			}
		}
	}
}

/** checking installed package size */
function checkInstalledSize(env: Env): void {
	const { config } = env;
	const installed = new Map<string, number>();
	let total = 0;
	const topNames = new Set(['DESCRIPTION', 'NAMESPACE', 'NEWS', 'NEWS.md', 'INDEX', 'LICENSE', 'LICENCE']);
	for(const f of env.files) {
		const parts = f.relative.split('/');
		let dir: string | undefined;
		if(parts.length === 1) {
			dir = topNames.has(f.relative) ? '' : undefined;
		} else if(['R', 'data', 'demo', 'exec', 'po'].includes(parts[0])) {
			dir = parts[0];
		} else if(parts[0] === 'man') {
			dir = 'help';
		} else if(parts[0] === 'inst') {
			dir = parts.length === 2 ? '' : parts[1];
		}
		if(dir !== undefined) {
			const size = env.size(f);
			total += size;
			installed.set(dir, (installed.get(dir) ?? 0) + size);
		}
	}
	const mb = (bytes: number) => bytes / Kb / Kb;
	if(mb(total) > config.maxInstalledSizeMb) {
		const big = [...installed].filter(([d, s]) => d !== '' && mb(s) >= config.maxSubdirSizeMb).sort(([a], [b]) => a.localeCompare(b));
		const list = big.map(([d, s]) => `${d} ${mb(s).toFixed(1)}Mb`).join(', ');
		env.out.add('installed-size', `Installed size is about ${mb(total).toFixed(1)}Mb${big.length > 0 ? `; sub-directories of ${config.maxSubdirSizeMb}Mb or more: ${list}` : ''}.`, 'DESCRIPTION', LintingResultCertainty.Uncertain);
	}
}

/** sizes of PDF files under 'inst/doc' */
function checkPdfSizes(env: Env): void {
	for(const f of env.files) {
		if(f.relative.startsWith('inst/doc/') && /\.pdf/.test(base(f.relative)) && f.relative !== 'inst/doc/Rplots.pdf' && env.size(f) > env.config.maxPdfBytes) {
			env.out.add('large-pdf', `The PDF file ${Quote(f.relative)} is ${(env.size(f) / Kb / Kb).toFixed(1)}Mb, consider running tools::compactPDF() on it, or build the source package with --compact-vignettes.`, f.relative, LintingResultCertainty.Uncertain);
		}
	}
}

/** line endings in shell scripts */
function checkLineEndings(env: Env): void {
	for(const f of env.children('.')) {
		if(!f.isDirectory && /^(configure|configure\.in|configure\.ac|cleanup)$/.test(f.relative) && env.pf.read(f.relative)?.includes('\r')) {
			env.out.add('crlf-shell-script', `Found the shell script ${Quote(f.relative)} with CR or CRLF line endings. Non-Windows OSes require LF line endings.`, f.relative);
		}
	}
}

/** leftover, mistaken and license-bound files among the direct children of a vignette-related directory */
function checkLooseFiles(env: Env, dir: string): void {
	const { out, config } = env;
	const names = env.children(dir);
	for(const e of names) {
		if(!e.isDirectory && config.filesAlreadyInR.includes(base(e.relative))) {
			out.add('file-already-in-r', `The file ${Quote(base(e.relative))} is already in R. Please remove it from your package.`, e.relative);
		}
	}
	const styles = env.files.filter(f => f.relative.startsWith(`${dir}/`) && /[.](cls|sty|drv)$/.test(f.relative) && !['jss.cls', 'jss.drv', 'Rnews.sty', 'RJournal.sty'].includes(base(f.relative)));
	for(const s of styles) {
		const text = env.pf.read(s.relative) ?? '';
		if(LicenseNotice.every(l => text.includes(l))) {
			out.add('license-requires-sources', `The file ${Quote(base(s.relative))} contains a license that requires distribution of original sources. Please ensure that you have complied with it.`, s.relative);
		}
	}
	const leftover = new RegExp(`[.](${config.leftoverExtensions.join('|')})$`, 'i');
	for(const e of names) {
		if(!e.isDirectory && (leftover.test(e.relative) || dir === 'vignettes' && ['Rplots.ps', 'Rplots.pdf'].includes(base(e.relative)))) {
			out.add('leftover-mistake', `The file ${Quote(base(e.relative))} looks like a leftover/mistake. Please remove it from your package.`, e.relative);
		}
	}
}

/** checking files in 'vignettes' */
function checkVignettes(env: Env): void {
	const { out, config, pf } = env;
	if(!env.children('.').some(e => e.relative === 'vignettes' && e.isDirectory)) {
		return;
	}
	const vignetteFiles = env.files.filter(f => f.relative.startsWith('vignettes/'));
	const docFiles = env.files.filter(f => f.relative.startsWith('inst/doc/'));
	const inVignettes = new Set(env.children('vignettes').map(e => base(e.relative)));
	for(const s of env.children('inst/doc')) {
		if(SweavePattern.test(s.relative) && !inVignettes.has(base(s.relative))) {
			out.add('vignette-source-missing', `Vignette source ${Quote(s.relative)} in 'inst/doc' missing from the 'vignettes' directory.`, s.relative);
		}
	}
	if(config.builtPackage && vignetteFiles.length > 0) {
		if(docFiles.length === 0) {
			out.add('vignettes-without-inst-doc', "Files in the 'vignettes' directory but no files in 'inst/doc'.", 'vignettes');
		} else if(pf.onDisk) {
			const docTimes = new Map(docFiles.map(f => [f.relative.slice('inst/doc/'.length), f.stats?.mtimeMs ?? 0]));
			const newest = Math.max(...docTimes.values());
			const tol = config.fileTimeTolerance * 1000;
			for(const v of vignetteFiles) {
				const t = v.stats?.mtimeMs;
				const sameName = docTimes.get(v.relative.slice('vignettes/'.length));
				if(t !== undefined && !v.isDirectory && (t > newest + tol || sameName !== undefined && t > sameName + tol)) {
					out.add('vignette-newer', `The file ${Quote(v.relative)} in the 'vignettes' directory is newer than ${t > newest + tol ? "all files in 'inst/doc'" : "the same file in 'inst/doc'"}.`, v.relative);
				}
			}
		}
	}
	const top = env.children('vignettes').filter(e => !base(e.relative).startsWith('.'));
	if(top.length > 0 && !top.some(e => SweavePattern.test(e.relative)) && !packageInfoHasBuilder(env)) {
		out.add('no-vignette-builder', 'Package has no Sweave vignette sources and no VignetteBuilder field.', 'DESCRIPTION');
	}
	checkLooseFiles(env, 'vignettes');
	const knitr = top.filter(e => e.isDirectory && ['cache', 'figure'].includes(base(e.relative)));
	for(const d of knitr) {
		out.add('knitr-leftover', `The directory ${Quote(base(d.relative))} looks like a leftover from 'knitr'. Please remove from your package.`, d.relative);
	}
}

function packageInfoHasBuilder(env: Env): boolean {
	return /^VignetteBuilder:/m.test(env.pf.read('DESCRIPTION') ?? '');
}

/** checking installed files from 'inst/doc' and left-overs from vignette generation */
function checkInstDoc(env: Env): void {
	const { out, config, pf } = env;
	for(const name of ['Rplots.ps', 'Rplots.pdf']) {
		const rel = `inst/doc/${name}`;
		if(env.has(rel) || pf.onDisk && fs.existsSync(path.join(pf.root, rel))) {
			out.add('vignette-leftover', `The file ${Quote(rel)} will not be installed: please remove it.`, rel);
		}
	}
	const docs = env.children('inst/doc');
	if(docs.length === 0) {
		return;
	}
	checkLooseFiles(env, 'inst/doc');
	const sources = new Set(docs.filter(e => VignettePattern.test(e.relative)).map(e => base(e.relative)));
	const stems = [...sources].map(s => s.replace(/\.[^.]+$/, ''));
	const stemPdf = stems.length > 0 ? new RegExp(`^(${stems.map(s => escapeRegex(s)).join('|')})-[0-9]+[.]pdf`) : undefined;
	const shouldNot = (name: string) => {
		const matched = ReusedDocExtensions.test(name) || /(Makefile|~$)/.test(name) || stemPdf?.test(name) === true;
		return (matched && (sources.size === 0 || !sources.has(name))) || /^fig.*[.]pdf$/.test(name);
	};
	for(const e of docs) {
		const name = base(e.relative);
		if(!e.isDirectory && !config.filesAlreadyInR.includes(name) && shouldNot(name)) {
			out.add('should-not-install', `The file ${Quote(name)} should probably not be installed. Consider the use of a .Rinstignore file, or move the vignette sources from 'inst/doc' to 'vignettes'.`, e.relative);
		} else if(e.isDirectory && config.docDirsNotInstalled.includes(name)) {
			out.add('should-not-install', `The directory ${Quote(name)} should probably not be installed. Consider the use of a .Rinstignore file, or move the vignette sources from 'inst/doc' to 'vignettes'.`, e.relative);
		}
	}
}

/**
 * Port of the file and directory structure checks of `R CMD check`, each finding naming its sub-check in `kind` and the offending file or directory in `file`:
 * `checking for portable file names` (invalid, reserved, case-clashing and not fully portable names, long paths), `checking for hidden files and directories`,
 * `checking top-level files` (defunct files, `configure` without sources, license files, non-standard files and directories),
 * `checking for left-over files`, `checking package subdirectories` (empty or misnamed `R`, `man`, `demo`, `data`, `exec`, `inst`, `src`, `tests`, invalid file names, system directories in `inst`, misplaced `CITATION`),
 * `checking 'build' directory` (the vignette index against the files), `checking for .dll and .exe files`, `checking for executable files`, `checking for sufficient/correct file permissions`,
 * `checking for future file timestamps`, `checking installed package size`, `checking sizes of PDF files under 'inst/doc'`, `checking line endings in shell scripts`,
 * `checking for left-overs from vignette generation`, `checking files in 'vignettes'` and `checking installed files from 'inst/doc'`.
 * The files are those that `R CMD build` keeps. The checks that need file system information (permissions, times, sizes, executables, `build/vignette.rds`) only run for packages on disk.
 */
export const PACKAGE_STRUCTURE = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const pf = packageFiles(ctx, pkg.name);
		if(pf === undefined) {
			return { results: [], '.meta': { inspectedEntries: 0, onDisk: false } };
		}
		const out = new Collector(pf);
		const entries = pf.entries;
		const paths = new Set(entries.map(e => e.relative));
		const byParent = new Map<string, PackageEntry[]>();
		for(const e of entries) {
			const parent = path.posix.dirname(e.relative);
			byParent.set(parent, [...byParent.get(parent) ?? [], e]);
		}
		const env: Env = {
			pf, out, config,
			pkgName:  pkg.name ?? path.basename(pf.root),
			license:  pkg.description?.content().get('License') ?? [],
			fossFlag: pkg.description?.content().get('License_is_FOSS')?.[0],
			has:      rel => paths.has(rel),
			files:    entries.filter(e => !e.isDirectory),
			dirs:     entries.filter(e => e.isDirectory),
			children: dir => byParent.get(dir) ?? [],
			size:     e => e.stats?.size ?? Buffer.byteLength(pf.read(e.relative) ?? '')
		};
		checkFileNames(env);
		checkHidden(env);
		checkTopLevel(env);
		checkLeftovers(env);
		checkSubdirectories(env);
		checkBuild(env);
		checkExecutables(env);
		checkLineEndings(env);
		checkVignettes(env);
		checkInstDoc(env);
		checkPdfSizes(env);
		if(pf.onDisk) {
			checkFileSystem(env);
			checkInstalledSize(env);
		}
		return { results: out.results, '.meta': { inspectedEntries: entries.length, onDisk: pf.onDisk } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Package Structure',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the file structure checks of `R CMD check`: `checking for portable file names`, `checking for hidden files and directories`, `checking top-level files`, `checking for left-over files`, `checking package subdirectories`, `checking \'build\' directory`, `checking for .dll and .exe files`, `checking for executable files`, `checking for sufficient/correct file permissions`, `checking for future file timestamps`, `checking installed package size`, `checking sizes of PDF files under \'inst/doc\'`, `checking line endings in shell scripts`, `checking for left-overs from vignette generation`, `checking files in \'vignettes\'` and `checking installed files from \'inst/doc\'`. Works on the files `R CMD build` keeps (after `.Rbuildignore`); checks that need file system information only run for packages on disk. Unlike `R CMD check`, every finding names the offending file, thresholds and lists are configurable, executables are recognized by their magic bytes, and the installed size is estimated without installing.',
		defaultConfig: () => ({
			maxPathLength:         100,
			maxTarPathLength:      256,
			hiddenAllowed:         ['.Rbuildignore', '.Rinstignore', 'vignettes/.install_extras', '.aspell'],
			cranKnownHidden:       ['.Renviron', '.Rprofile', '.Rproj.user', '.Rhistory', '.Rapp.history', '.tex', '.log', '.aux', '.pdf', '.png', '.backups', '.cvsignore', '.cproject', '.directory', '.dropbox', '.exrc', '.gdb.history', '.gitattributes', '.gitignore', '.gitmodules', '.hgignore', '.hgtags', '.project', '.seed', '.settings', '.tm_properties'],
			cranPack:              true,
			checkTopLevel:         true,
			standardTopLevel:      ['DESCRIPTION', 'INDEX', 'LICENCE', 'LICENSE', 'LICENCE.note', 'LICENSE.note', 'MD5', 'NAMESPACE', 'NEWS', 'PORTING', 'COPYING', 'COPYING.LIB', 'GPL-2', 'GPL-3', 'BUGS', 'Bugs', 'ChangeLog', 'Changelog', 'CHANGELOG', 'CHANGES', 'Changes', 'INSTALL', 'README', 'THANKS', 'TODO', 'ToDo', 'SHA256', 'SHA256.sig', 'INSTALL.windows', 'README.md', 'NEWS.md', 'configure', 'configure.win', 'cleanup', 'cleanup.win', 'configure.ucrt', 'cleanup.ucrt', 'configure.ac', 'configure.in', 'datafiles', 'R', 'data', 'demo', 'exec', 'inst', 'man', 'po', 'src', 'tests', 'vignettes', 'build', '.aspell', 'upstream', 'java', 'tools', 'noweb'],
			checkBashisms:         false,
			reservedInstDirs:      ['Meta', 'R', 'data', 'demo', 'exec', 'libs', 'man', 'help', 'html', 'latex', 'R-ex', 'build'],
			maxInstalledSizeMb:    5,
			maxSubdirSizeMb:       1,
			maxPdfBytes:           1024 * 1024,
			checkFutureTimestamps: true,
			futureLeewaySeconds:   300,
			fileTimeTolerance:     10,
			builtPackage:          false,
			leftoverExtensions:    ['log', 'aux', 'bbl', 'blg', 'dvi', 'toc', 'out', 'Rd', 'Rout', 'dbj', 'drv', 'ins'],
			filesAlreadyInR:       ['jss.cls', 'jss.bst', 'Rd.sty', 'Sweave.sty'],
			docDirsNotInstalled:   ['auto', 'Bilder', 'fig', 'figs', 'figures', 'Figures', 'img', 'images', 'JSSstyle', 'jssStyle', 'screenshots2', 'src', 'tex', 'tmp']
		})
	}
} as const satisfies LintingRule<PackageStructureResult, PackageStructureMetadata, PackageStructureConfig>;
