import { type FlowrFileProvider, type FileRole , FlowrFile } from '../../../context/flowr-file';
import type { Info } from 'spdx-expression-parse';
import parse from 'spdx-expression-parse';
import { log } from '../../../../util/log';
import type { RAuthorInfo } from '../../../../util/r-author';
import { parseRAuthorString } from '../../../../util/r-author';
import { splitAtEscapeSensitive } from '../../../../util/text/args';

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

	/**
	 * Returns the parsed license information from the 'License' field in the DESCRIPTION file.
	 */
	public license(): Info[] | undefined {
		const licenses = this.content().get('License');
		if(!licenses) {
			return undefined;
		}
		return parseRLicenseField(...licenses);
	}

	/**
	 * Returns the parsed authors from the `Authors@R` field in the DESCRIPTION file.
	 */
	public authors(): RAuthorInfo[] | undefined {
		const authors = this.content().get('Authors@R');
		return authors ? authors.flatMap(parseRAuthorString) : undefined;
	}
}

function cleanUpDescLicense(licenseStr: string): string {
	// we have to replace '\s[|+&]\s' with ' OR ' or ' AND ' respectively
	return licenseStr
		.replace(/\s*[|]\s*/g, ' OR ')
		.replace(/\s*[&+,]\s*/g, ' AND ')
		// we have to replace any variant of 'file LICENSE' with just 'LicenseRef-FILE
		.replace(/file(\s+|-)LICENSE/gi, 'LicenseRef-FILE')
	;
}

/**
 * Parses the 'License' field from an R DESCRIPTION file into SPDX license expressions.
 * @param licenseField - The 'License' field from the DESCRIPTION file as an array of strings.
 * @returns An array of SPDX license information objects if parsing was successful.
 */
export function parseRLicenseField(...licenseField: string[]): Info[] {
	const licenses: Info[] = [];
	for(const licenseEntry of licenseField) {
		const cleanedLicense = cleanUpDescLicense(licenseEntry);
		try {
			const parsed = parse(cleanedLicense);
			licenses.push(parsed);
		} catch(e) {
			log.warn(`Failed to parse license expression '${cleanedLicense}': ${(e as Error).message}`);
		}
	}
	return licenses;
}


function emplaceDCF(key: string, val: string, result: Map<string, string[]>) {
	if(!key) {
		return;
	}
	let values: string[] = [];
	if(key.includes('@')) {
		values = [val.trim()];
	} else {
		values = val ? cleanValues(val) : [];
	}
	result.set(key, values);
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
			emplaceDCF(currentKey, currentValue, result);

			const [key, rest] = line.split(firstColonRegex).map(s => s.trim());
			currentKey = key?.trim() ?? '';
			currentValue = rest?.trim() ?? '';
		}
	}

	emplaceDCF(currentKey, currentValue, result);

	return result;
}

const splitRegex = /[\n\r]+/g;
function cleanValues(values: string): string[] {
	return values.split(splitRegex).flatMap(l => splitAtEscapeSensitive(l, false, ','))
		.map(s => s.trim())
		.filter(s => s.length > 0);
}
