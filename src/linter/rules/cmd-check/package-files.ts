import fs from 'fs';
import path from 'path';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { FileRole, type FlowrFileProvider } from '../../../project/context/flowr-file';
import { SourceLocation } from '../../../util/range';
import { RPath } from '../../../util/files';

/**
 * One file or directory of the package, as `R CMD build` would put it into the tarball.
 */
export interface PackageEntry {
	/** the path relative to the package root, with `/` as separator */
	readonly relative:    string
	/** the absolute path */
	readonly absolute:    string
	readonly isDirectory: boolean
	/** the file's stats, `undefined` for files flowR only knows in memory */
	readonly stats?:      fs.Stats
}

/** The files of a package that `R CMD check` sees, and how to read them. */
export interface PackageFiles {
	/** the package root (the folder of the DESCRIPTION) */
	readonly root:    string
	/** every file and directory that survives `R CMD build`, the root itself excluded */
	readonly entries: readonly PackageEntry[]
	/** whether the listing comes from the file system (and is hence complete), not just from the files flowR knows */
	readonly onDisk:  boolean
	/** the text of a file given relative to the root, `undefined` if it does not exist or cannot be read */
	readonly read:    (relative: string) => string | undefined
	/** a location naming the file (and optionally a line) for a finding */
	readonly locate:  (relative: string, line?: number, endLine?: number) => SourceLocation
}

/** the version-control directories `R CMD build` drops (`tools:::.vc_dir_names`) */
const VcDirectories: ReadonlySet<string> = new Set(['CVS', '.svn', '.arch-ids', '.bzr', '.git', '.hg', '_darcs', '.metadata']);
/** the hidden files `R CMD build` drops (`tools:::.hidden_file_exclusions`) */
const HiddenFileExclusions: ReadonlySet<string> = new Set([
	'.Renviron', '.Rprofile', '.Rproj.user', '.Rhistory', '.Rapp.history', '.tex', '.log', '.aux', '.pdf', '.png', '.backups',
	'.cvsignore', '.cproject', '.directory', '.dropbox', '.exrc', '.gdb.history', '.gitattributes', '.gitignore', '.gitmodules',
	'.hgignore', '.hgtags', '.htaccess', '.latex2html-init', '.project', '.seed', '.settings', '.tm_properties'
]);
/** the patterns `R CMD build` always excludes (`tools:::get_exclude_patterns()`) */
const DefaultExcludePatterns: readonly string[] = [
	'^\\.Rbuildignore$', '(^|/)\\.DS_Store$', '^\\.(RData|Rhistory)$', '~$', '\\.bak$', '\\.sw.$', '(^|/)\\.#[^/]*$', '(^|/)#[^/]*#$',
	'^TITLE$', '^data/00Index$', '^inst/doc/00Index\\.dcf$', '^config\\.(cache|log|status)$', '(^|/)autom4te\\.cache$', '^src/.*\\.d$',
	'^src/Makedeps$', '^src/so_locations$', '^inst/doc/Rplots\\.(ps|pdf)$', '^(GPATH|GRTAGS|GTAGS)$'
];
/**
 * The DESCRIPTION of the analyzed package: the one closest to the project root, as packages vendored into it or
 * test fixtures shipped with it (`src/library/x/DESCRIPTION`, `tests/testthat/fixtures/p/DESCRIPTION`) have their own.
 */
export function rootDescriptionFile(ctx: ReadOnlyFlowrAnalyzerContext): FlowrFileProvider | undefined {
	const descriptions = ctx.files.getFilesByRole(FileRole.Description);
	return descriptions.length < 2 ? descriptions[0]
		: descriptions.toSorted((a, b) => a.path().split(/[\\/]/).length - b.path().split(/[\\/]/).length || a.path().localeCompare(b.path()))[0];
}

/** do not walk deeper or wider than this, a package is no file system */
const MaxEntries = 50_000;

/** the `.Rbuildignore` patterns plus the defaults, compiled; a pattern that is no valid regular expression is skipped */
function excludePatterns(rbuildignore: string | undefined): RegExp[] {
	const lines = [...DefaultExcludePatterns, ...(rbuildignore?.split(/\r?\n/) ?? [])].filter(l => l.trim() !== '');
	const result: RegExp[] = [];
	for(const line of lines) {
		try {
			result.push(new RegExp(line, 'i'));
		} catch{
			/* R would fail on it as well, but that is not this listing's finding to make */
		}
	}
	return result;
}

/** whether `R CMD build` drops the entry (and, for a directory, everything below it) */
function isExcludedByBuild(relative: string, isDirectory: boolean, pkgName: string | undefined, patterns: readonly RegExp[]): boolean {
	const base = path.posix.basename(relative);
	if(isDirectory && (VcDirectories.has(base) || base === 'check' || base === 'chm' || /([Oo]ld|\.Rcheck)$/.test(base) || /^src.*\/[.]deps$/.test(relative))) {
		return true;
	}
	if(base === 'Read-and-delete-me' || base === 'GNUMakefile' || base.startsWith('._') || HiddenFileExclusions.has(base) || /^\.Rbuildindex[.]/.test(relative)) {
		return true;
	}
	if(relative.endsWith('inst/doc/.Rinstignore') || relative.endsWith('inst/doc/.build.timestamp') || relative.endsWith('vignettes/.Rinstignore')) {
		return true;
	}
	if(pkgName !== undefined && (relative === `src/${pkgName}_res.rc` || new RegExp(`^${pkgName.replace(/\./g, '\\.')}_[0-9.-]+\\.(tar\\.gz|tar|tar\\.bz2|tar\\.xz|tgz|zip)$`).test(relative))) {
		return true;
	}
	return patterns.some(p => p.test(relative));
}

/**
 * The files and directories of the analyzed package as `R CMD check` sees them, i.e. after `R CMD build` dropped
 * what `.Rbuildignore` and its defaults exclude. When the package lives on disk, the whole folder is listed;
 * otherwise (e.g. files only handed to flowR in memory) the files flowR knows below the package root are used.
 * `undefined` without a DESCRIPTION.
 */
export function packageFiles(ctx: ReadOnlyFlowrAnalyzerContext, pkgName?: string): PackageFiles | undefined {
	const desc = rootDescriptionFile(ctx);
	if(desc === undefined) {
		return undefined;
	}
	const root = path.dirname(desc.path());
	const known = new Map(ctx.files.getAllFiles().map(f => [RPath.normalize(f.path()), f]));
	const readKnownOrDisk = (absolute: string): string | undefined => {
		const file = known.get(RPath.normalize(absolute));
		try {
			if(file !== undefined) {
				return file.rawText?.() ?? file.content().toString();
			}
			return fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? fs.readFileSync(absolute, 'utf-8') : undefined;
		} catch{
			return undefined;
		}
	};
	const patterns = excludePatterns(readKnownOrDisk(path.join(root, '.Rbuildignore')));
	const toRelative = (absolute: string) => path.relative(root, absolute).split(path.sep).join('/');
	const entries: PackageEntry[] = [];
	const onDisk = fs.existsSync(path.join(root, 'DESCRIPTION'));
	if(onDisk) {
		const stack = [root];
		for(let dir = stack.pop(); dir !== undefined && entries.length < MaxEntries; dir = stack.pop()) {
			let names: string[];
			try {
				names = fs.readdirSync(dir);
			} catch{
				continue;
			}
			for(const name of names) {
				const absolute = path.join(dir, name);
				let stats: fs.Stats;
				try {
					stats = fs.lstatSync(absolute);
				} catch{
					continue;
				}
				const relative = toRelative(absolute);
				const isDirectory = stats.isDirectory();
				if(isExcludedByBuild(relative, isDirectory, pkgName, patterns)) {
					continue;
				}
				entries.push({ relative, absolute, isDirectory, stats });
				if(isDirectory) {
					stack.push(absolute);
				}
			}
		}
	} else {
		const dirs = new Set<string>();
		for(const absolute of known.keys()) {
			const relative = toRelative(absolute);
			if(relative.startsWith('..') || path.isAbsolute(relative) || isExcludedByBuild(relative, false, pkgName, patterns)) {
				continue;
			}
			entries.push({ relative, absolute, isDirectory: false });
			for(let d = path.posix.dirname(relative); d !== '.' && !dirs.has(d); d = path.posix.dirname(d)) {
				dirs.add(d);
			}
		}
		for(const d of dirs) {
			entries.push({ relative: d, absolute: path.join(root, d), isDirectory: true });
		}
	}
	entries.sort((a, b) => a.relative.localeCompare(b.relative));
	return {
		root,
		entries,
		onDisk,
		read:   relative => readKnownOrDisk(path.join(root, relative)),
		locate: (relative, line, endLine) => {
			const absolute = path.join(root, relative);
			return SourceLocation.from([line ?? 1, 1, endLine ?? line ?? 1, 1], known.get(RPath.normalize(absolute))?.path() ?? absolute);
		}
	};
}
