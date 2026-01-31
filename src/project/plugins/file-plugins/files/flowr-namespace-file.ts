import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import { unquoteArgument } from '../../../../abstract-interpretation/data-frame/resolve-args';
import { removeRQuotes } from '../../../../r-bridge/retriever';

export interface NamespaceInfo {
	exportedSymbols:      string[];
	exportedFunctions:    string[];
	exportS3Generics:     Map<string, string[]>;
	exportedPatterns:     string[];
	importedPackages:     Map<string, string[] | 'all'>;
	loadsWithSideEffects: boolean;
}

export interface NamespaceFormat {
	current:               NamespaceInfo;
	[packageName: string]: NamespaceInfo;
}

/**
 * This decorates a text file and provides access to its content in the {@link NamespaceFormat}.
 */
export class FlowrNamespaceFile extends FlowrFile<NamespaceFormat> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 * Prefer the static {@link FlowrNamespaceFile.from} method to create instances of this class as it will not re-create if already a namespace file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	/**
	 * Loads and parses the content of the wrapped file in the {@link NamespaceFormat}.
	 * @see {@link parseNamespace} for details on the parsing logic.
	 */
	protected loadContent(): NamespaceFormat {
		return parseNamespace(this.wrapped);
	}

	/**
	 * Namespace file lifter, this does not re-create if already a namespace file
	 */
	public static from(file: FlowrFileProvider | FlowrNamespaceFile, role?: FileRole): FlowrNamespaceFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrNamespaceFile ? file : new FlowrNamespaceFile(file);
	}
}


const cleanLineCommentRegex = /^#.*$/gm;

/**
 * Parses the given NAMESPACE file
 */
function parseNamespace(file: FlowrFileProvider): NamespaceFormat {
	const result = {
		current: {
			exportedSymbols:      [] as string[],
			exportedFunctions:    [] as string[],
			exportS3Generics:     new Map<string, string[]>(),
			exportedPatterns:     [] as string[],
			importedPackages:     new Map<string, string[] | 'all'>(),
			loadsWithSideEffects: false,
		},
	} as NamespaceFormat;
	const fileContent = file.content().toString().replaceAll(cleanLineCommentRegex, '').trim()
		.split(/\r?\n/).filter(Boolean);

	for(const line of fileContent) {
		const match = line.trim().match(/^(\w+)\(([^)]*)\)$/);
		if(!match) {
			continue;
		}
		const [, type, args] = match;

		switch(type) {
			case 'exportClasses':
			case 'exportMethods':
				result.current.exportedFunctions.push(removeRQuotes(args));
				break;
			case 'S3method':
			{
				const parts = args.split(',').map(s => removeRQuotes(s.trim()));
				if(parts.length !== 2) {
					continue;
				}
				const [pkg, func] = parts;
				let arr = result.current.exportS3Generics.get(pkg);
				if(!arr) {
					arr = [];
					result.current.exportS3Generics.set(pkg, arr);
				}
				arr.push(func);
				break;
			}
			case 'export':
				result.current.exportedSymbols.push(removeRQuotes(args));
				break;
			case 'useDynLib':
			{
				const parts = args.split(',').map(s => s.trim());
				if(parts.length !== 2) {
					continue;
				}
				const [pkg] = parts;
				if(!result[pkg]) {
					result[pkg] = {
						exportedSymbols:      [],
						exportedFunctions:    [],
						exportS3Generics:     new Map<string, string[]>(),
						exportedPatterns:     [],
						importedPackages:     new Map<string, string[] | 'all'>(),
						loadsWithSideEffects: false,
					};
				}
				result[pkg].loadsWithSideEffects = true;
				break;
			}
			case 'import': {
				const pkg = args.trim();
				result.current.importedPackages?.set(pkg, 'all');
				break;
			}
			case 'importFrom': {
				const parts = args.split(',').map(s => s.trim());
				if(parts.length < 2) {
					continue;
				}
				const [pkg, ...symbols] = parts;
				let arr = result.current.importedPackages?.get(pkg);
				if(!arr || arr === 'all') {
					arr = [];
					result.current.importedPackages?.set(pkg, arr);
				}
				arr.push(...symbols);
				break;
			}
			case 'exportPattern': {
				result.current.exportedPatterns?.push(unquoteArgument(args.trim()));
				break;
			}
		}
	}

	return result;
}