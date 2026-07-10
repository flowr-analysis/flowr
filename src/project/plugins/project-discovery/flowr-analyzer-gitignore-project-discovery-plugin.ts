import { FlowrAnalyzerProjectDiscoveryPlugin } from './flowr-analyzer-project-discovery-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { isParseRequest } from '../../../r-bridge/retriever';
import type { FlowrFile } from '../../context/flowr-file';
import path from 'path';
import fs from 'fs';
import type ignore from 'ignore';

/** Lazily loaded on first use so `ignore` is only required when the gitignore plugin actually runs. */
let ignoreFactory: typeof ignore | undefined;
function loadIgnore(): typeof ignore {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on demand, see above
	return ignoreFactory ??= require('ignore') as typeof ignore;
}

/**
 * Decorator around any {@link FlowrAnalyzerProjectDiscoveryPlugin} that filters discovered files
 * by the rules in a `.gitignore` file found at the project root.
 * If no `.gitignore` exists, the inner plugin's results are returned unchanged.
 *
 * Register as `'project-discovery:gitignore'` (see {@link BuiltInPlugins}) to replace the
 * default discovery plugin with a gitignore-aware variant.
 */
export class FlowrAnalyzerGitignoreProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name        = 'flowr-analyzer-gitignore-project-discovery-plugin';
	public readonly description = 'Wraps a project discovery plugin and filters results by .gitignore rules.';
	public readonly version     = new SemVer('0.1.0');
	private readonly inner: FlowrAnalyzerProjectDiscoveryPlugin;

	constructor(inner: FlowrAnalyzerProjectDiscoveryPlugin = FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin()) {
		super();
		this.inner = inner;
	}

	protected process(context: FlowrAnalyzerContext, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		const ig = loadIgnore()();
		const gitignorePath = path.join(args.content, '.gitignore');
		if(fs.existsSync(gitignorePath)) {
			ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
		}
		return this.inner.processor(context, args).filter(r => {
			const filePath = isParseRequest(r) && r.request === 'file' ? r.content : !isParseRequest(r) ? r.path() : undefined;
			if(filePath === undefined) {
				return true;
			}
			const relative = path.relative(args.content, filePath);
			return relative === '' || !ig.ignores(relative);
		});
	}
}
