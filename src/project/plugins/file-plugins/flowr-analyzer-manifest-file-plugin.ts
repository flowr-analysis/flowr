import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformBasename
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { FlowrRProjectFile, FlowrUvrManifestFile } from './files/flowr-manifest-files';

const RProjectFilePattern = /^rproject\.toml$/i;
const UvrManifestFilePattern = /^uvr\.toml$/i;

/**
 * Tags a project manifest with the {@link FileRole.Manifest} role and lifts it, so the meta plugins reading it
 * can look it up by role.
 */
abstract class FlowrAnalyzerManifestFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * @param pathPattern - The pattern to identify the manifest, see the respective subclass for its default.
	 */
	constructor(pathPattern: RegExp) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformBasename(file.toString()));
	}
}

/** Lifts an rv `rproject.toml` to a {@link FlowrRProjectFile}. */
export class FlowrAnalyzerRProjectFilePlugin extends FlowrAnalyzerManifestFilePlugin {
	public readonly name = 'flowr-analyzer-rproject-file-plugin';
	public readonly description = 'Marks the rproject.toml manifest of an rv project.';

	constructor(pathPattern: RegExp = RProjectFilePattern) {
		super(pathPattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		return [FlowrRProjectFile.from(file, FileRole.Manifest), true];
	}
}

/** Lifts a uvr `uvr.toml` to a {@link FlowrUvrManifestFile}. */
export class FlowrAnalyzerUvrManifestFilePlugin extends FlowrAnalyzerManifestFilePlugin {
	public readonly name = 'flowr-analyzer-uvr-manifest-file-plugin';
	public readonly description = 'Marks the uvr.toml manifest of a uvr project.';

	constructor(pathPattern: RegExp = UvrManifestFilePattern) {
		super(pathPattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		return [FlowrUvrManifestFile.from(file, FileRole.Manifest), true];
	}
}
