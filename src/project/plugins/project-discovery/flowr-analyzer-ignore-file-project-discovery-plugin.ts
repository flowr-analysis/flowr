import { FlowrAnalyzerProjectDiscoveryPlugin } from './flowr-analyzer-project-discovery-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';
import type { RParseRequest } from '../../../r-bridge/retriever';
import { isParseRequest } from '../../../r-bridge/retriever';
import type { FlowrFile } from '../../context/flowr-file';
import path from 'path';
import fs from 'fs';
import { loadIgnore, rbuildignoreMatcher } from '../../../util/glob';

/**
 * The ignore files a {@link FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin} can respect.
 * They differ in their pattern language, see {@link ignoreMatcher}.
 */
export enum IgnoreFileKind {
	/** `.gitignore`, gitignore-style globs */
	Gitignore    = 'gitignore',
	/** `.Rbuildignore`, one (Perl-compatible) regular expression per line, as used by `R CMD build` */
	Rbuildignore = 'rbuildignore'
}

const ignoreFileNames: Record<IgnoreFileKind, string> = {
	[IgnoreFileKind.Gitignore]:    '.gitignore',
	[IgnoreFileKind.Rbuildignore]: '.Rbuildignore'
};

/** Reads the ignore file of `kind` at `root` and returns a matcher for paths relative to `root`, if it exists. */
function ignoreMatcher(kind: IgnoreFileKind, root: string): ((relativePath: string) => boolean) | undefined {
	const file = path.join(root, ignoreFileNames[kind]);
	if(!fs.existsSync(file)) {
		return undefined;
	}
	const content = fs.readFileSync(file, 'utf-8');
	if(kind === IgnoreFileKind.Rbuildignore) {
		return rbuildignoreMatcher(content);
	}
	const ig = loadIgnore()().add(content);
	return relativePath => ig.ignores(relativePath);
}

/**
 * Decorator around any {@link FlowrAnalyzerProjectDiscoveryPlugin} that filters the discovered files
 * by the ignore files found at the project root. Ignore files that do not exist are skipped, so with
 * none of them present the inner plugin's results are returned unchanged.
 *
 * Use {@link FlowrAnalyzerGitignoreProjectDiscoveryPlugin} (`'project-discovery:gitignore'`),
 * {@link FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin} (`'project-discovery:rbuildignore'`), or
 * `'project-discovery:ignore-files'` for both. As every variant wraps an inner discovery plugin, they
 * can also be nested to combine them with a custom discovery plugin.
 */
export class FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name:        string = 'flowr-analyzer-ignore-file-project-discovery-plugin';
	public readonly description: string = 'Wraps a project discovery plugin and filters results by .gitignore and .Rbuildignore rules.';
	public readonly version     = new SemVer('0.1.0');
	private readonly inner:      FlowrAnalyzerProjectDiscoveryPlugin;
	private readonly kinds:      readonly IgnoreFileKind[];

	/**
	 * @param kinds - the ignore files to respect
	 * @param inner - the discovery plugin providing the files to filter
	 */
	constructor(
		kinds: readonly IgnoreFileKind[] = [IgnoreFileKind.Gitignore, IgnoreFileKind.Rbuildignore],
		inner: FlowrAnalyzerProjectDiscoveryPlugin = FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin()
	) {
		super();
		this.kinds = kinds;
		this.inner = inner;
	}

	protected process(context: FlowrAnalyzerContext, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		const matchers = this.kinds.map(k => ignoreMatcher(k, args.content)).filter(m => m !== undefined);
		const inner = this.inner.processor(context, args);
		if(matchers.length === 0) {
			return inner;
		}
		return inner.filter(r => {
			const filePath = isParseRequest(r) && r.request === 'file' ? r.content : !isParseRequest(r) ? r.path() : undefined;
			if(filePath === undefined) {
				return true;
			}
			const relative = path.relative(args.content, filePath);
			return relative === '' || !matchers.some(m => m(relative));
		});
	}
}

/** Filters the discovered files by the `.gitignore` at the project root, see {@link FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin}. */
export class FlowrAnalyzerGitignoreProjectDiscoveryPlugin extends FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin {
	public readonly name        = 'flowr-analyzer-gitignore-project-discovery-plugin';
	public readonly description = 'Wraps a project discovery plugin and filters results by .gitignore rules.';

	constructor(inner: FlowrAnalyzerProjectDiscoveryPlugin = FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin()) {
		super([IgnoreFileKind.Gitignore], inner);
	}
}

/** Filters the discovered files by the `.Rbuildignore` at the package root, see {@link FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin}. */
export class FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin extends FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin {
	public readonly name        = 'flowr-analyzer-rbuildignore-project-discovery-plugin';
	public readonly description = 'Wraps a project discovery plugin and filters results by .Rbuildignore rules.';

	constructor(inner: FlowrAnalyzerProjectDiscoveryPlugin = FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin()) {
		super([IgnoreFileKind.Rbuildignore], inner);
	}
}
