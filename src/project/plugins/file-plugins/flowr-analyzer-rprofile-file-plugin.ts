import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

/** `Rprofile.site` is the site-wide, `.Rprofile` the user/project profile. */
export const RprofileFilePattern = /^(\.Rprofile|Rprofile\.site)$/i;

/** {@link FlowrAnalyzerLoadingOrderRprofilePlugin} moves the tagged files to the front of the loading order. */
export class FlowrAnalyzerRprofileFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-rprofile-file-plugin';
	public readonly description = 'Marks R startup profiles (.Rprofile, Rprofile.site).';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	constructor(pathPattern: RegExp = RprofileFilePattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformBasename(file.toString()));
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		file.assignRole(FileRole.Startup);
		file.assignRole(FileRole.Source);
		return [file, true];
	}
}
