import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { SpecialFileRole } from '../../context/flowr-file';
import { FlowrNamespaceFile } from './flowr-namespace-file';

/**
 * This plugin provides support for R `NAMESPACE` files.
 */
export class FlowrAnalyzerNamespaceFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-namespace-file-plugin';
	public readonly description = 'This plugin provides support for NAMESPACE files and extracts their content into the NAMESPACEFormat.';
	public readonly version = new SemVer('0.1.0');

	public applies(file: PathLike): boolean {
		return /^(NAMESPACE|NAMESPACE\.txt)$/i.test(file.toString().split(/[/\\]/).pop() ?? '');
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider<string>): FlowrNamespaceFile {
		const f = FlowrNamespaceFile.from(file, SpecialFileRole.Namespace);
		// already load it here
		f.content();
		return f;
	}
}