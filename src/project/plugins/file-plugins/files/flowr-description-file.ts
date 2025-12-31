import { type FlowrFileProvider, type FileRole , FlowrFile } from '../../../context/flowr-file';
import type { RAuthorInfo } from '../../../../util/r-author';
import { AuthorRole , parseTextualAuthorString , parseRAuthorString } from '../../../../util/r-author';
import { splitAtEscapeSensitive } from '../../../../util/text/args';
import type { DeepReadonly } from 'ts-essentials';
import type { RLicenseElementInfo } from '../../../../util/r-license';
import { parseRLicense } from '../../../../util/r-license';
import { Package, type PackageType } from '../../package-version-plugins/package';

export type DCF = Map<string, string[]>;

/**
 * This decorates a text file and provides access to its content as a DCF (Debian Control File)-like structure.
 */
export class FlowrDescriptionFile extends FlowrFile<DeepReadonly<DCF>> {
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
	public license(): RLicenseElementInfo[] | undefined {
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
		let authors = this.content().get('Authors@R');
		if(authors) {
			return authors.flatMap(parseRAuthorString);
		}
		authors = this.content().get('Author');
		const parsedAuthors: RAuthorInfo[] = authors?.flatMap(a => parseTextualAuthorString(a, [AuthorRole.Author])) ?? [];
		return parsedAuthors.concat(
			this.content().get('Maintainer')?.flatMap(m => parseTextualAuthorString(m, [AuthorRole.Creator])) ?? []
		);
	}

	public suggests(): Package[] | undefined {
		const suggests = this.content().get('Suggests');
		return suggests ? parsePackagesWithVersions(suggests, 'package') : undefined;
	}
}

/**
 * Parses the 'License' field from an R DESCRIPTION file into SPDX license expressions.
 * @param licenseField - The 'License' field from the DESCRIPTION file as an array of strings.
 * @returns An array of SPDX license information objects if parsing was successful.
 */
export function parseRLicenseField(...licenseField: string[]): RLicenseElementInfo[] {
	return licenseField.map(parseRLicense);
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


const VersionRegex = /^([a-zA-Z0-9.]+)(?:\s*\(([><=~!]+)\s*([^)]+)\))?$/;

/**
 * Parses package strings with optional version constraints into Package objects.
 * @param packageStrings - The package strings to parse
 * @param type           - The type of the packages (e.g., 'r' or 'package')
 */
export function parsePackagesWithVersions(packageStrings: readonly string[], type?: PackageType): Package[] {
	const packages: Package[] = [];
	for(const entry of packageStrings) {
		const match = VersionRegex.exec(entry);

		if(match) {
			const [, name, operator, version] = match;

			const range = Package.parsePackageVersionRange(operator, version);
			packages.push(new Package(
				{
					name:               name,
					type:               type,
					versionConstraints: range ? [range] : undefined
				}
			));
		}
	}
	return packages;
}