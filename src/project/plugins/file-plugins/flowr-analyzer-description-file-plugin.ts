import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { parseDCF } from '../../../util/files';
import type { FlowrFileProvider } from '../../context/flowr-analyzer-files-context';
import { FlowrFile } from '../../context/flowr-analyzer-files-context';
import type { PathLike } from 'fs';
import { log } from '../../../util/log';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';

export type DCF = Map<string, string[]>;

export class FlowrDescriptionFile extends FlowrFile<DCF> {
	protected loadContent(): DCF {
		return parseDCF(this.filePath);
	}


	/**
     * Description file lifter, this does not re-create if already a description file
     */
	public static from(file: FlowrFileProvider): FlowrDescriptionFile {
		return file instanceof FlowrDescriptionFile ? file : new FlowrDescriptionFile(file.path(), file.role);
	}
}

export const descriptionFileLog = log.getSubLogger({ name: 'flowr-analyzer-loading-order-description-file-plugin' });

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin<FlowrFileProvider, FlowrDescriptionFile> {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin provides support for DESCRIPTION files and extracts their content into key-value(s) pairs.';
	public readonly version = new SemVer('0.1.0');
	public information: Map<string, string[]> = new Map<string, string[]>();

	public applies(file: PathLike): boolean {
		return /^(DESCRIPTION|DESCRIPTION\.txt)$/i.test(file.toString().split('/').pop() || '');
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrDescriptionFile {
		const f = FlowrDescriptionFile.from(file);
		// already load it here
		f.content();
		return f;
	}
}