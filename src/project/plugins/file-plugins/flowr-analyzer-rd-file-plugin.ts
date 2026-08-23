import { SemVer } from 'semver';
import { FlowrAnalyzerPatternFilePlugin } from './flowr-analyzer-file-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { FlowrRdFile, FlowrRdIndexFile } from './files/flowr-rd-file';

/** `.Rd` manual pages, `NEWS.Rd` excluded: that one is a changelog and belongs to the NEWS plugin. */
const RdFilePattern = /^(?!NEWS\.rd$).+\.rd$/i;
/** the alias-to-topic table an *installed* package carries instead of its `man/` sources */
const RdIndexFilePattern = /^AnIndex$/;

/**
 * This plugin provides support for R `.Rd` manual pages, the source of a package's help. A page states which
 * names it documents (its `\alias{}`es), so the pages together decide which manual page documents a name --
 * and whether a name is documented at all. Use {@link rdIndexOf} to ask that of the loaded pages.
 */
export class FlowrAnalyzerRdFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-rd-file-plugin';
	public readonly description = 'Reads .Rd manual pages into the Rd page format.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Rd file plugin.
	 * @param filePattern - The pattern to identify manual pages, see {@link RdFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = RdFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRdFile {
		return FlowrRdFile.from(file, FileRole.Documentation);
	}
}

/**
 * This plugin provides support for the `help/AnIndex` table of an installed package, which states the same
 * alias-to-topic mapping the `man/` sources do for a package that is only checked out.
 */
export class FlowrAnalyzerRdIndexFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-rd-index-file-plugin';
	public readonly description = 'Reads an installed package\'s help/AnIndex into the alias-to-topic mapping.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Rd index file plugin.
	 * @param filePattern - The pattern to identify help indices, see {@link RdIndexFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = RdIndexFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRdIndexFile {
		return FlowrRdIndexFile.from(file, FileRole.Documentation);
	}
}
