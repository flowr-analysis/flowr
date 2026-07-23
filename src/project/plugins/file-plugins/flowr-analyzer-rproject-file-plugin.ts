import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformBasename
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrRProjectFile } from './files/flowr-rproject-file';

/** The manifest of an rv project. */
const RProjectFilePattern = /^rproject\.toml$/i;

/**
 * Tags an rv project's `rproject.toml` with the {@link FileRole.Manifest} role and lifts it to a
 * {@link FlowrRProjectFile}, so the meta plugin reading it can look it up by role.
 */
export class FlowrAnalyzerRProjectFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-rproject-file-plugin';
	public readonly description = 'Marks the rproject.toml manifest of an rv project.';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the rproject file plugin.
	 * @param pathPattern - The pattern to identify the manifest, see {@link RProjectFilePattern} for the default.
	 */
	constructor(pathPattern: RegExp = RProjectFilePattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformBasename(file.toString()));
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		return [FlowrRProjectFile.from(file, FileRole.Manifest), true];
	}
}
