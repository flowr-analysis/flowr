import { type FlowrFileProvider, type FileRole , FlowrFile } from '../../../context/flowr-file';

export type DCF = Map<string, string[]>;

/**
 * This decorates a text file and provides access to its content as a DCF (Debian Control File)-like structure.
 */
export class FlowrDescriptionFile extends FlowrFile<DCF> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 * Prefer the static {@link FlowrDescriptionFile.from} method to create instances of this class as it will not re-create if already a description file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.role);
		this.wrapped = file;
	}

	/**
	 * Loads and parses the content of the wrapped file as a DCF structure.
	 * @see {@link parseDCF} for details on the parsing logic.
	 */
	protected loadContent(): DCF {
		return parseDCF(this.wrapped);
	}


	/**
	 * Description file lifter, this does not re-create if already a description file
	 */
	public static from(file: FlowrFileProvider | FlowrDescriptionFile, role?: FileRole): FlowrDescriptionFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrDescriptionFile ? file : new FlowrDescriptionFile(file);
	}

	// TODO: add helper methods to get version, parsed authors, parsed spdx license etc, ...
}


/**
 * Parses the given file in the 'Debian Control Format'.
 * @param file - The file to parse
 */
function parseDCF(file: FlowrFileProvider): Map<string, string[]> {
	const result = new Map<string, string[]>();
	let currentKey = '';
	let currentValue = '';
	const indentRegex = new RegExp(/^\s/);
	const firstColonRegex = new RegExp(/:(.*)/s);

	const fileContent = file.content().toString().split(/\r?\n/);

	for(const line of fileContent) {
		if(indentRegex.test(line)) {
			currentValue += '\n' + line.trim();
		} else {
			if(currentKey) {
				const values = currentValue ? cleanValues(currentValue) : [];
				result.set(currentKey, values);
			}

			const [key, rest] = line.split(firstColonRegex).map(s => s.trim());
			currentKey = key?.trim() ?? '';
			currentValue = rest?.trim() ?? '';
		}
	}

	if(currentKey) {
		const values = currentValue ? cleanValues(currentValue) : [];
		result.set(currentKey, values);
	}

	return result;
}


const cleanSplitRegex = /[\n,]+/;
const cleanQuotesRegex = /'/g;

function cleanValues(values: string): string[] {
	return values
		.split(cleanSplitRegex)
		.map(s => s.trim().replace(cleanQuotesRegex, ''))
		.filter(s => s.length > 0);
}
