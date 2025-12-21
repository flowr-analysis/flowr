import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import { FlowrNamespaceFile } from './files/flowr-namespace-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

const NamespaceFilePattern = /^NAMESPACE(\.txt)?$/i;

/**
 * This plugin provides support for R `NAMESPACE` files.
 */
export class FlowrAnalyzerNamespaceFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-namespace-file-plugin';
	public readonly description = 'This plugin provides support for NAMESPACE files and extracts their content into the NAMESPACEFormat.';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the NAMESPACE file plugin.
	 * @param filePattern - The pattern to identify NAMESPACE files, see {@link NamespaceFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = NamespaceFilePattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		return this.pattern.test(platformBasename(file.toString()));
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrNamespaceFile {
		return FlowrNamespaceFile.from(file, FileRole.Namespace);
	}
}