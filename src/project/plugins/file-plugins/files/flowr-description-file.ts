import { type FlowrFileProvider, type FileRole, FlowrFile, FlowrTextFile } from '../../../context/flowr-file';
import type { RAuthorInfo } from '../../../../util/r-author';
import { AuthorRole, parseTextualAuthorString, parseRAuthorString } from '../../../../util/r-author';
import { splitAtEscapeSensitive } from '../../../../util/text/args';
import type { DeepReadonly } from 'ts-essentials';
import type { RLicenseElementInfo } from '../../../../util/r-license';
import { parseRLicense } from '../../../../util/r-license';
import { Package, type PackageType } from '../../package-version-plugins/package';
import { removeRQuotes } from '../../../../r-bridge/retriever';
import type { SemVer } from 'semver';
import { parseRVersion } from '../../../../util/r-version';

export type DCF = Map<string, string[]>;

/**
 * This decorates a text file and provides access to its content as a DCF (Debian Control File)-like structure.
 * Please use the static {@link FlowrDescriptionFile.from} method to create instances of this class.
 * To access description specific fields, use the provided methods like {@link license}, {@link authors}, {@link suggests}, and {@link collate}.
 * These methods parse and return the relevant information in structured formats.
 * To access raw fields, use the {@link content} method inherited from {@link FlowrFile}.
 */
export class FlowrDescriptionFile extends FlowrFile<DeepReadonly<DCF>> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 * Prefer the static {@link FlowrDescriptionFile.from} method to create instances of this class as it will not re-create if already a description file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
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
	 * Creates a FlowrDescriptionFile from given DCF content, path and optional roles.
	 * This is useful if you already have the DCF content parsed and want to create a description file instance without re-parsing.
	 */
	public static fromDCF(dcf: DCF, path: string, roles?: FileRole[]): FlowrDescriptionFile {
		const file = new FlowrDescriptionFile(new FlowrTextFile(path, roles));
		file.setContent(dcf);
		return file;
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
	 * Returns the parsed version from the 'Version' field in the DESCRIPTION file.
	 */
	public version(): SemVer & { str: string } | undefined {
		const v = this.content().get('Version');
		if(!v || v.length === 0) {
			return undefined;
		}
		const verStr = v[0].trim();
		return parseRVersion(verStr);
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

	/**
	 * Returns the parsed suggested packages from the 'Suggests' field in the DESCRIPTION file.
	 */
	public suggests(): Package[] | undefined {
		const suggests = this.content().get('Suggests');
		return suggests ? parsePackagesWithVersions(suggests, 'package') : undefined;
	}

	/**
	 * Returns the 'Collate' field from the DESCRIPTION file.
	 */
	public collate(): readonly string[] | undefined {
		const c = this.content().get('Collate');
		// we join newlines, and then split quote sensitive:
		return c ? splitAtEscapeSensitive(c.join(' '), true, ' ').map(s => removeRQuotes(s).trim()).filter(s => s.length > 0) : undefined;
	}

	/**
	 * Returns the parsed dependencies from the 'Depends' field in the DESCRIPTION file.
	 */
	public depends(): readonly Package[] | undefined {
		const deps = this.content().get('Depends');
		return deps ? parsePackagesWithVersions(deps, 'r') : undefined;
	}

	/**
	 * Returns the parsed imports from the 'Imports' field in the DESCRIPTION file.
	 */
	public imports(): readonly Package[] | undefined {
		const imps = this.content().get('Imports');
		return imps ? parsePackagesWithVersions(imps, 'package') : undefined;
	}

	/**
	 * Returns the package name from the 'Package' field in the DESCRIPTION file.
	 */
	public packageName(): string | undefined {
		const names = this.content().get('Package');
		return names && names.length > 0 ? names[0] : names?.join(' ');
	}

	/**
	 * Returns the package title from the 'Title' field in the DESCRIPTION file.
	 */
	public packageTitle(): string | undefined {
		const titles = this.content().get('Title');
		return titles && titles.length > 0 ? titles[0] : titles?.join(' ');
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


const VersionRegex = /([a-zA-Z0-9.]+)(?:\s*\(([><=~!]+)\s*([^)]+)\))?\s*/;

/**
 * Parses package strings with optional version constraints into Package objects.
 * @param packageStrings - The package strings to parse
 * @param type           - The type of the packages (e.g., 'r' or 'package')
 */
export function parsePackagesWithVersions(packageStrings: readonly string[], type?: PackageType): Package[] {
	let str = packageStrings.join(' ');
	let match: RegExpExecArray | null;
	const packages: Package[] = [];
	// match until exhaustion
	while((match = VersionRegex.exec(str)) !== null) {
		const [, name, operator, version] = match;

		const range = Package.parsePackageVersionRange(operator, version);
		packages.push(new Package(
			{
				name:               name,
				type:               type,
				versionConstraints: range ? [range] : undefined
			}
		));
		str = str.slice(match.index + match[0].length);
	}
	return packages;
}