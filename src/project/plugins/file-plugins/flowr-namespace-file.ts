import type { FlowrFileProvider, SpecialFileRole } from '../../context/flowr-file';
import { FlowrFile } from '../../context/flowr-file';
import { parseNAMESPACE } from '../../../util/files';

export interface NamespaceInfo {
	exportedSymbols:      string[];
	exportedFunctions:    string[];
	exportS3Generics:     Map<string, string[]>;
	loadsWithSideEffects: boolean;
}

export interface NAMESPACEFormat {
	this:                  NamespaceInfo;
	[packageName: string]: NamespaceInfo;
}

/**
 *
 */
export class FlowrNamespaceFile extends FlowrFile<NAMESPACEFormat> {
	private readonly wrapped: FlowrFileProvider<string>;

	/**
	 *
	 */
	constructor(file: FlowrFileProvider<string>) {
		super(file.path(), file.role);
		this.wrapped = file;
	}

	/**
	 *
	 *
	 * @see {@link parseNAMESPACE} for details on the parsing logic.
	 */
	protected loadContent(): NAMESPACEFormat {
		return parseNAMESPACE(this.wrapped);
	}


	/**
	 * Namespace file lifter, this does not re-create if already a namespace file
	 */
	public static from(file: FlowrFileProvider<string> | FlowrNamespaceFile, role?: SpecialFileRole): FlowrNamespaceFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrNamespaceFile ? file : new FlowrNamespaceFile(file);
	}
}