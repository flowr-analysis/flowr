import type { FlowrFileProvider, SpecialFileRole } from '../../context/flowr-file';
import { FlowrFile } from '../../context/flowr-file';
import { parseDCF } from '../../../util/files';

export type DCF = Map<string, string[]>;

export class FlowrDescriptionFile extends FlowrFile<DCF> {
	private wrapped: FlowrFileProvider<string>;

	constructor(file: FlowrFileProvider<string>) {
		super(file.path(), file.role);
		this.wrapped = file;
	}

	protected loadContent(): DCF {
		return parseDCF(this.wrapped);
	}


	/**
     * Description file lifter, this does not re-create if already a description file
     */
	public static from(file: FlowrFileProvider<string> | FlowrDescriptionFile, role?: SpecialFileRole): FlowrDescriptionFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrDescriptionFile ? file : new FlowrDescriptionFile(file);
	}
}