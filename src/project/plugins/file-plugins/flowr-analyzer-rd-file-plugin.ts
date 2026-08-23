import type { PathLike } from 'fs';
import { SemVer } from 'semver';
import { FlowrAnalyzerPatternFilePlugin } from './flowr-analyzer-file-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import {
	FlowrDataListFile,
	FlowrRdFile,
	FlowrRdIndexFile,
	FlowrRdMacroFile,
	FlowrRdMetaFile,
	FlowrRdTopicIndexFile
} from './files/flowr-rd-file';

/** `.Rd` manual pages, `NEWS.Rd` excluded: that one is a changelog and belongs to the NEWS plugin. */
const RdFilePattern = /^(?!NEWS\.rd$).+\.rd$/i;
/**
 * A `man/macros/` (installed: `help/macros/`) file, which holds `\newcommand` definitions other pages use and
 * documents nothing itself. Reading one as a page would claim its file name as a topic and, worse, shadow the
 * page of a function that happens to share it.
 */
const RdMacroDirectory = /(^|[\\/])macros[\\/][^\\/]+$/i;
/** the alias-to-topic table an *installed* package carries instead of its `man/` sources */
const RdIndexFilePattern = /^AnIndex$/;
/** the `\newcommand` files of {@link RdMacroDirectory}, which state markup the package's pages use */
const RdMacroFilePattern = /\.rd$/i;
/** a package's `INDEX` and the `00Index` of its `demo/`: the same fixed-width `topic  title` table */
const RdTopicIndexFilePattern = /^(INDEX|00Index)$/;
/** the help table an installed package serializes, the richest of the sources (aliases, keywords, titles) */
const RdMetaFilePattern = /^Rd\.rds$/i;
/** which R objects each of a package's datasets provides */
const DataListFilePattern = /^datalist$/i;

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

	public override applies(file: PathLike): boolean {
		return super.applies(file) && !RdMacroDirectory.test(file.toString());
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

/**
 * This plugin provides support for a package's `man/macros/` (installed: `help/macros/`) files. They document
 * nothing themselves; they define the `\newcommand`s the package's pages use, which {@link rdIndexOf} expands
 * before reading those pages.
 */
export class FlowrAnalyzerRdMacroFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-rd-macro-file-plugin';
	public readonly description = 'Reads the \\newcommand definitions of man/macros/ files.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Rd macro file plugin.
	 * @param filePattern - The pattern to identify macro files, see {@link RdMacroFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = RdMacroFilePattern) {
		super(filePattern);
	}

	public override applies(file: PathLike): boolean {
		return super.applies(file) && RdMacroDirectory.test(file.toString());
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRdMacroFile {
		return FlowrRdMacroFile.from(file, FileRole.Documentation);
	}
}

/**
 * This plugin provides support for a package's `INDEX` and the `00Index` of its `demo/`: the topic-and-title
 * table R keeps beside the pages, which states what a package documents even where no `man/` sources are.
 */
export class FlowrAnalyzerRdTopicIndexFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-rd-topic-index-file-plugin';
	public readonly description = 'Reads INDEX/00Index topic tables into their topic-to-title mapping.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the topic index plugin.
	 * @param filePattern - The pattern to identify topic tables, see {@link RdTopicIndexFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = RdTopicIndexFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRdTopicIndexFile {
		return FlowrRdTopicIndexFile.from(file, FileRole.Documentation);
	}
}

/**
 * This plugin provides support for the `Meta/Rd.rds` help table an installed package serializes. It states per
 * page what the `man/` sources do -- topic, aliases, keywords, title -- so an installed-only package answers
 * the same questions a checked-out one does.
 */
export class FlowrAnalyzerRdMetaFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-rd-meta-file-plugin';
	public readonly description = 'Reads an installed package\'s Meta/Rd.rds help table.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the Rd metadata plugin.
	 * @param filePattern - The pattern to identify the help table, see {@link RdMetaFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = RdMetaFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrRdMetaFile {
		return FlowrRdMetaFile.from(file, FileRole.Documentation);
	}
}

/**
 * This plugin provides support for a package's `data/datalist`, which states which R objects each of its
 * datasets provides -- the only place a `data(<set>)` that binds differently named objects is written down.
 */
export class FlowrAnalyzerDataListFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-datalist-file-plugin';
	public readonly description = 'Reads data/datalist into the objects each dataset provides.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the datalist plugin.
	 * @param filePattern - The pattern to identify the list, see {@link DataListFilePattern} for the default.
	 */
	constructor(filePattern: RegExp = DataListFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrDataListFile {
		return FlowrDataListFile.from(file, FileRole.Data);
	}
}
