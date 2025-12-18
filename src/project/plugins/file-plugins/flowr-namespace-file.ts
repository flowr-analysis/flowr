import type { FileRole, FlowrFileProvider } from '../../context/flowr-file';
import { FlowrFile } from '../../context/flowr-file';
import { parseNamespace } from '../../../util/files';

export interface NamespaceInfo {
	exportedSymbols:      string[];
	exportedFunctions:    string[];
	exportS3Generics:     Map<string, string[]>;
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
		super(file.path(), file.role);
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