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
 *
 */
export class FlowrNamespaceFile extends FlowrFile<NamespaceFormat> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 *
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.role);
		this.wrapped = file;
	}

	/**
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