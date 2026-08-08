import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

/** `Rprofile.site` is the site-wide, `.Rprofile` the user/project profile. */
export const RprofileFilePattern = /^(\.Rprofile|Rprofile\.site)$/i;
/** `.Renviron` is the user/project environment file, `Renviron.site` the site-wide one. */
export const RenvironFilePattern = /^(\.Renviron|Renviron\.site)$/i;

/**
 * Marks R startup files: profiles (`.Rprofile`, `Rprofile.site`) are R source, so they get
 * {@link FileRole.Startup} and {@link FileRole.Source}; environment files (`.Renviron`, `Renviron.site`) hold
 * `KEY=value` definitions rather than R code, so they only get {@link FileRole.Environment}.
 * The {@link FlowrAnalyzerLoadingOrderRprofilePlugin} moves the profile files to the front of the loading order.
 */
export class FlowrAnalyzerRprofileFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-rprofile-file-plugin';
	public readonly description = 'Marks R startup files (.Rprofile, Rprofile.site, .Renviron, Renviron.site).';
	public readonly version = new SemVer('0.2.0');
	private readonly profilePattern: RegExp;
	private readonly environPattern: RegExp;

	constructor(profilePattern: RegExp = RprofileFilePattern, environPattern: RegExp = RenvironFilePattern) {
		super();
		this.profilePattern = profilePattern;
		this.environPattern = environPattern;
	}

	public applies(file: PathLike): boolean {
		const base = platformBasename(file.toString());
		return this.profilePattern.test(base) || this.environPattern.test(base);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		if(this.environPattern.test(platformBasename(file.path()))) {
			file.assignRole(FileRole.Environment);
		} else {
			file.assignRole(FileRole.Startup);
			file.assignRole(FileRole.Source);
		}
		return [file, true];
	}
}
