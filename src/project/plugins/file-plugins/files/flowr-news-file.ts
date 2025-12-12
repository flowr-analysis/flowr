import { type FlowrFileProvider, type FileRole , FlowrFile } from '../../../context/flowr-file';
import { RPunctuationChars, RStandardRegexp } from '../../../../util/r-regex';
import { compactRecord } from '../../../../util/objects';

export interface NewsChunk {
	header?:  string;
	version?: string;
	date?:    string;
	entries:  string[] | NewsChunk[];
}

/**
 * This decorates a text file and provides access to its content following R's NEWS file structure.
 */
export class FlowrNewsFile extends FlowrFile<NewsChunk[]> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 * Prefer the static {@link FlowrNewsFile.from} method to create instances of this class as it will not re-create if already a news file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.role);
		this.wrapped = file;
	}

	/**
	 * Loads and parses the content of the wrapped file as news chunks.
	 * @see {@link parseNews} for details on the parsing logic.
	 */
	protected loadContent(): NewsChunk[] {
		return parseNews(this.wrapped);
	}


	/**
	 * News file lifter, this does not re-create if already a news file
	 */
	public static from(file: FlowrFileProvider | FlowrNewsFile, role?: FileRole): FlowrNewsFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrNewsFile ? file : new FlowrNewsFile(file);
	}
}

function makeRversionRegex(): RegExp {
	// ^([[:space:]]*(%s)|(%s))(%s).*$
	const fst = 'CHANGES? *(IN|FOR).*VERSION *|CHANGES? *(IN|FOR|TO) *';
	const pVersion = RStandardRegexp.ValidPackageVersion.source;
	const pName = RStandardRegexp.ValidPackageName.source;
	const teachingDemos = [
		// TeachingDemos pomp ouch
		'NEW IN .*',
		// HyperbolicDist nls2 proto
		'VERSION:? *',
		`${pName} +`,
		// E.g., lattice:
		//   Changes in lattice 0.17
		`CHANGES IN ${pName} +`,
		// sv*
		`== Changes in ${pName} +`,
		// tcltk2
		'== Version +',
		// R2WinBUGS
		'update *',
		'v *',
		'',
	].join('|');
	const weAreNicerFlags = 'i';
	const pkgVersionLine = `\\s*(${pName})\\s+version\\s+(${pVersion})\\s*|\\s*#+\\s*${pName} (\\([^)]*\\)|${pVersion}).*`;
	return new RegExp(`^(\\s*(${fst})|(${teachingDemos}))((${pVersion}).*)|${pkgVersionLine}$`, weAreNicerFlags);
}

//"^.*([[:digit:]]{4}-[[:digit:]]{2}-[[:digit:]]{2})[[:punct:][:space:]]*$",
const RDateRegex = new RegExp(`^.*(\\d{4}-\\d{2}-\\d{2})[${RPunctuationChars}\\s]*$`);
// ^[[:space:]]*([o*+-])
const RBulletPointRegex = /^\s*(?<bullet>[o*+-])/;
// ^([[:alpha:]].*)[[:space:]]*$"
const RCategoryRegex = /^((#+\s*)?([A-Za-z].*))\s*$/;
const AnyVersionRegex = new RegExp(
	RStandardRegexp.ValidPackageVersion.source + '|deve(l(opment)?)? ver(sion)?|(?<=\\()[^)]*(?=\\))',
);

function splitLinesRegex(relevantLines: string[], regex: RegExp) {
	const lineChunks: string[][] = [];
	let currentChunk: string[] = [];
	for(const line of relevantLines) {
		if(regex.test(line)) {
			if(currentChunk.length > 0) {
				lineChunks.push(currentChunk);
			}
			currentChunk = [line];
		} else {
			currentChunk.push(line);
		}
	}
	if(currentChunk.length > 0) {
		lineChunks.push(currentChunk);
	}
	return lineChunks;
}


/**
 * Parses the given file into news chunks.
 * @param file - The file to parse
 * @see https://github.com/r-devel/r-svn/blob/44474af03ae77fd3b9a340279fa10cb698d106c3/src/library/tools/R/news.R#L91-L92
 */
function parseNews(file: FlowrFileProvider): NewsChunk[] {
	// ^[[:space:]]*[[:punct:]]*[[:space:]]*
	const noiseRegex = new RegExp(`^\\s*[${RPunctuationChars}]*\\s*$`);
	const lines = file.content().toString().split(/\r?\n/)
	// first we clean underlines and friends (according to the R impl)
		.filter(l => !noiseRegex.test(l));

	// this is a port of the incredible complex R NEWS regex, but luckily it is  not too liberal :D
	const regexVersion = makeRversionRegex();

	// filter lines that match the version regex
	const versionLines = lines.map(line =>
		regexVersion.test(line)
	);

	// drop the header by removing everything before the first match
	const firstVersionIndex = versionLines.findIndex(v => v);
	const relevantLines = lines.slice(firstVersionIndex);

	// split at every version line
	const lineChunks = splitLinesRegex(relevantLines, regexVersion);

	/**
	 * @see https://github.com/r-devel/r-svn/blob/44474af03ae77fd3b9a340279fa10cb698d106c3/src/library/tools/R/news.R#L183
	 */
	function processChunk(lines: string[], header: string | undefined): NewsChunk {
		let date: string | undefined;
		let head: string | undefined;
		if(header) {
			head = AnyVersionRegex.exec(header)?.[0];
			date = RDateRegex.exec(header)?.[1];
		}
		const content = lines.join('\n').trim();
		const hasBullets = RBulletPointRegex.exec(content);
		if(hasBullets) {
			const separator = hasBullets.groups?.bullet ?? '-';
			const lineChunks = splitLinesRegex(
				lines, new RegExp(`^\\s*[${separator}]\\s+`)
			).map(
				// apparently we have to trim leading '\tab' indentations
				chunkLines => chunkLines.map(l => {
					return l.replace(new RegExp(`^\\s*[${separator}]\\s+`), '').replace(/^\t?/gm, '').trim();
				}).join('\n')
			);
			return compactRecord({
				header,
				version: head,
				date,
				entries: lineChunks
			});
		} else {
			// from the spec: "Categories should be non-empty starting in column 1."
			const categoryChunks = splitLinesRegex(
				lines, RCategoryRegex
			);
			// different to R we may accept no category blobs here
			return compactRecord({
				header,
				version: head,
				date,
				entries: categoryChunks.length > 1 ?
					categoryChunks.map(
						chunkLines => processChunk(chunkLines, header = RCategoryRegex.exec(chunkLines[0])?.[1])
					) : [content]
			});
		}
	}

	return lineChunks.map(l => processChunk(l.slice(1), l[0]));
}