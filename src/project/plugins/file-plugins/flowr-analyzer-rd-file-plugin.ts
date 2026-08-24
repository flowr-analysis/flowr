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
/** a `man/macros/` (installed: `help/macros/`) file, which holds `\newcommand` definitions and documents nothing itself */
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

/** Shared body of the `.Rd`-family plugins below; a concrete class only adds its name, description, default pattern, `lift`, and (twice) `applies`. */
abstract class FlowrAnalyzerRdFileBasePlugin<F extends FlowrFileProvider> extends FlowrAnalyzerPatternFilePlugin {
	public readonly version = new SemVer('0.1.0');

	/** Lifts a matched file into this plugin's `FlowrXFile`, tagged with its {@link FileRole}. */
	protected abstract readonly lift: (file: FlowrFileProvider) => F;

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): F {
		return this.lift(file);
	}
}

/** Support for R `.Rd` manual pages: a page states which names it documents (its `\alias{}`es); see {@link rdIndexOf}. */
export class FlowrAnalyzerRdFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrRdFile> {
	public readonly name = 'flowr-analyzer-rd-file-plugin';
	public readonly description = 'Reads .Rd manual pages into the Rd page format.';

	constructor(filePattern: RegExp = RdFilePattern) {
		super(filePattern);
	}

	public override applies(file: PathLike): boolean {
		return super.applies(file) && !RdMacroDirectory.test(file.toString());
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrRdFile => FlowrRdFile.from(file, FileRole.Documentation);
}

/** Support for an installed package's `help/AnIndex`: the same alias-to-topic mapping the `man/` sources give a checkout. */
export class FlowrAnalyzerRdIndexFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrRdIndexFile> {
	public readonly name = 'flowr-analyzer-rd-index-file-plugin';
	public readonly description = 'Reads an installed package\'s help/AnIndex into the alias-to-topic mapping.';

	constructor(filePattern: RegExp = RdIndexFilePattern) {
		super(filePattern);
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrRdIndexFile => FlowrRdIndexFile.from(file, FileRole.Documentation);
}

/** Support for a package's `man/macros/` (installed: `help/macros/`) files, whose `\newcommand`s {@link rdIndexOf} expands before reading pages. */
export class FlowrAnalyzerRdMacroFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrRdMacroFile> {
	public readonly name = 'flowr-analyzer-rd-macro-file-plugin';
	public readonly description = 'Reads the \\newcommand definitions of man/macros/ files.';

	constructor(filePattern: RegExp = RdMacroFilePattern) {
		super(filePattern);
	}

	public override applies(file: PathLike): boolean {
		return super.applies(file) && RdMacroDirectory.test(file.toString());
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrRdMacroFile => FlowrRdMacroFile.from(file, FileRole.Documentation);
}

/** Support for a package's `INDEX` and `demo/00Index`: the topic-and-title table R keeps even where no `man/` sources are. */
export class FlowrAnalyzerRdTopicIndexFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrRdTopicIndexFile> {
	public readonly name = 'flowr-analyzer-rd-topic-index-file-plugin';
	public readonly description = 'Reads INDEX/00Index topic tables into their topic-to-title mapping.';

	constructor(filePattern: RegExp = RdTopicIndexFilePattern) {
		super(filePattern);
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrRdTopicIndexFile => FlowrRdTopicIndexFile.from(file, FileRole.Documentation);
}

/** Support for the `Meta/Rd.rds` help table an installed package serializes, states what the `man/` sources do -- topic, aliases, keywords, title. */
export class FlowrAnalyzerRdMetaFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrRdMetaFile> {
	public readonly name = 'flowr-analyzer-rd-meta-file-plugin';
	public readonly description = 'Reads an installed package\'s Meta/Rd.rds help table.';

	constructor(filePattern: RegExp = RdMetaFilePattern) {
		super(filePattern);
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrRdMetaFile => FlowrRdMetaFile.from(file, FileRole.Documentation);
}

/** Support for a package's `data/datalist`: the only place a `data(<set>)` binding differently named objects is written down. */
export class FlowrAnalyzerDataListFilePlugin extends FlowrAnalyzerRdFileBasePlugin<FlowrDataListFile> {
	public readonly name = 'flowr-analyzer-datalist-file-plugin';
	public readonly description = 'Reads data/datalist into the objects each dataset provides.';

	constructor(filePattern: RegExp = DataListFilePattern) {
		super(filePattern);
	}

	protected readonly lift = (file: FlowrFileProvider): FlowrDataListFile => FlowrDataListFile.from(file, FileRole.Data);
}
