import path from 'path';
import { SemVer } from 'semver';
import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrConfig, TreeSitterEngineConfig } from '../../../config';
import type { NormalizedAst, ParentInformation  } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PackageSignatureSource } from '../../sigdb/reader';
import { MemorySignatureSource } from '../../sigdb/memory-source';
import { packageFromExports } from './flowr-analyzer-package-versions-sigdb-plugin';
import { OnDemandRecoverer, onDemandLog, type OnDemandOptions } from '../../sigdb/on-demand/recoverer';
import { builtInOnDemandSources, parseGitHubRemote, type FetchBytes, type OnDemandSource, type PackageRequest } from '../../sigdb/on-demand/remote-sources';
import { sanitizeRecovered, type RecoveredPackage } from '../../sigdb/on-demand/package-sources';
import type { BuiltInIndex } from '../../../dataflow/environments/query-fn-props';
import { ArgProp, CallProp, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { httpsFetcher } from '../../sigdb/on-demand/fetch';
import { sigDbCacheDir } from '../../sigdb/decompress';
import { TreeSitterExecutor } from '../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { DescriptionFile } from '../file-plugins/flowr-analyzer-description-file-plugin';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Identifier } from '../../../dataflow/environments/identifier';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { SecureMode } from '../../../util/secure-mode';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';

/** the calls naming the packages to load in their arguments */
const Loaders: ReadonlySet<string> = new Set(['library', 'require', 'requireNamespace', 'loadNamespace', 'attachNamespace', 'use', 'p_load', 'pkg_attach', 'pkg_attach2']);
/** the calls installing packages from where their arguments name, like `remotes::install_github("masurp/ggmirt")` */
const Installers: ReadonlySet<string> = new Set(['install_github', 'install_gitlab', 'pkg_install', 'pak', 'p_load_gh', 'p_install_gh', 'install']);

/** a name or string literal as the text it stands for */
function literalText(node: RNode<ParentInformation> | undefined): string | undefined {
	if(RSymbol.is(node)) {
		return Identifier.getName(node.content);
	} else if(RString.is(node)) {
		return node.content.str;
	}
	return undefined;
}

/** What the code says about the packages it uses: their names, and the repositories it installs some of them from. */
export function packagesNamedIn(ast: NormalizedAst): { names: Set<string>, github: Map<string, string> } {
	const names = new Set<string>();
	const github = new Map<string, string>();
	for(const node of ast.idMap.values()) {
		if(RSymbol.is(node)) {
			const ns = Identifier.getNamespace(node.content);
			if(ns !== undefined) {
				names.add(ns);
			}
		} else if(RFunctionCall.isNamed(node)) {
			const fn = Identifier.getName(node.functionName.content);
			const values = node.arguments.map(a => a === null || a === undefined ? undefined : literalText((a as { value?: RNode<ParentInformation> }).value));
			if(Loaders.has(fn)) {
				/* every one `pacman::p_load(a, b)` names, only the first `library(a, character.only = TRUE)` does */
				(fn === 'p_load' || fn.startsWith('pkg_attach') ? values : values.slice(0, 1)).forEach(v => v !== undefined && names.add(v));
			} else if(Installers.has(fn)) {
				for(const value of values) {
					const remote = value === undefined ? undefined : parseGitHubRemote(value);
					if(remote !== undefined) {
						github.set(remote.repo, value as string);
					}
				}
			}
		}
	}
	return { names, github };
}

/** what makes a built-in matter to a security analysis: running code or commands, reaching the network, files, or databases, emitting HTML or JavaScript, loading code */
const SecurityRelevant = [
	SemanticCallTag.Eval, SemanticCallTag.Process, SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Database,
	SemanticCallTag.Html, SemanticCallTag.JavaScript, SemanticCallTag.Opens, SemanticCallTag.User, SemanticCallTag.Reads,
	SemanticCallTag.Writes, SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage
];

/**
 * The names of the security-relevant built-ins, see {@link SecurityRelevant}, and of those with an argument open
 * to injection or naming a resource. A package flowR fetched on demand is no package anyone vetted, so it may not
 * export one of these: `library(evil)` exporting `system` would otherwise turn every later `system(cmd)` into a
 * call of `evil::system`, which no analysis looking for `system` would see.
 */
export function shieldedNames(index: BuiltInIndex): ReadonlySet<string> {
	return new Set([
		...index.with(SecurityRelevant), ...index.with(CallProp.Ffi),
		...index.params(ArgProp.Injectable | ArgProp.Resource).map(p => p.call)
	].map(Identifier.getName));
}

/** the hosts of the mirrors the (trusted) configuration names, which may be on the local network */
function mirrorHosts(opts: OnDemandOptions): ReadonlySet<string> {
	return new Set([opts.cranMirror, opts.bioconductorMirror].flatMap(m => {
		try {
			return m === undefined ? [] : [new URL(m).host];
		} catch{
			return [];
		}
	}));
}

/** the GitHub remotes of the project's `DESCRIPTION` (`Remotes: masurp/ggmirt`), by repository name */
function descriptionRemotes(ctx: FlowrAnalyzerContext): Map<string, string> {
	const remotes = new Map<string, string>();
	const description = DescriptionFile.single(ctx, 'no DESCRIPTION, so no Remotes');
	for(const entry of description?.content().get('Remotes')?.flatMap(e => e.split(',')) ?? []) {
		const remote = parseGitHubRemote(entry.trim());
		if(remote !== undefined) {
			remotes.set(remote.repo, entry.trim());
		}
	}
	return remotes;
}

/**
 * Recovers packages no signature database knows from their sources when the analyzed code uses them: before the
 * dataflow is built it fetches the source of every package the code loads or names with `::` that nothing else
 * resolves, from GitHub (the repository the project installs it from or the configuration names), CRAN, or
 * Bioconductor, and serves their exports and the formals of their functions. Off unless
 * `solver.sigdb.onDemand.enabled` says otherwise, never in secure mode, and only for packages nothing else knows.
 * Further sources come in through the constructor.
 */
export class FlowrAnalyzerPackageVersionsOnDemandPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-versions-on-demand-plugin';
	public readonly description = 'Fetches the sources of packages no database knows from CRAN, Bioconductor, or GitHub.';
	public readonly version = new SemVer('0.1.0');

	private readonly overrides?:   Partial<OnDemandOptions>;
	private readonly extraSources: readonly OnDemandSource[];
	private readonly fetchBytes:   FetchBytes | undefined;
	private readonly recovered = new Map<string, RecoveredPackage>();
	private source:                MemorySignatureSource | undefined;
	private recoverer:             OnDemandRecoverer | undefined;
	private parser:                TreeSitterExecutor | undefined;
	private shielded:              ReadonlySet<string> | undefined;

	/**
	 * @param overrides    - options replacing what `solver.sigdb.onDemand` states, `enabled` included
	 * @param extraSources - sources besides the built-in ones, used where `sources` lists their name (or after the listed ones if it does not)
	 * @param fetchBytes   - how to download, HTTPS to public hosts and the configured mirrors by default
	 */
	constructor(overrides?: Partial<OnDemandOptions>, extraSources: readonly OnDemandSource[] = [], fetchBytes?: FetchBytes) {
		super();
		this.overrides = overrides;
		this.extraSources = extraSources;
		this.fetchBytes = fetchBytes;
	}

	private optionsOf(config: FlowrConfig): OnDemandOptions {
		return { ...config.solver.sigdb.onDemand, ...this.overrides } as OnDemandOptions;
	}

	private sourcesOf(opts: OnDemandOptions): OnDemandSource[] {
		const known = new Map([...builtInOnDemandSources(opts), ...this.extraSources.map(s => [s.name, s] as const)]);
		const listed = opts.sources ?? ['github', 'cran', 'bioconductor'];
		const unknown = listed.filter(n => !known.has(n));
		if(unknown.length > 0) {
			onDemandLog.warn(`unknown on-demand signature sources: ${unknown.join(', ')}`);
		}
		const sources = listed.flatMap(n => known.get(n) ?? []);
		return [...sources, ...this.extraSources.filter(s => !listed.includes(s.name))];
	}

	private recovererOf(ctx: FlowrAnalyzerContext, opts: OnDemandOptions): OnDemandRecoverer {
		this.recoverer ??= new OnDemandRecoverer(opts, {
			sources: this.sourcesOf(opts),
			fetch:   this.fetchBytes ?? httpsFetcher(mirrorHosts(opts)),
			parse:   code => {
				this.parser ??= new TreeSitterExecutor();
				return this.parser.parseCode(code);
			},
			cacheDir: opts.cacheDir ?? path.join(sigDbCacheDir(undefined, false), 'on-demand')
		});
		return this.recoverer;
	}

	/** whether the options allow recovering `name` at all */
	private static wanted(opts: OnDemandOptions, name: string): boolean {
		return !isBaseRPackage(name) && (opts.packages === undefined || opts.packages.length === 0 || opts.packages.some(p => new RegExp(p).test(name)));
	}

	/** keeps the package, without the exports that would take over a security-relevant built-in, see {@link shieldedNames} */
	private remember(ctx: FlowrAnalyzerContext, pkg: RecoveredPackage): RecoveredPackage | undefined {
		this.shielded ??= shieldedNames(ctx.env.builtInIndex);
		const safe = sanitizeRecovered(pkg, this.shielded);
		const dropped = pkg.exported.filter(n => this.shielded?.has(n));
		if(dropped.length > 0) {
			onDemandLog.warn(`${pkg.name} (${pkg.origin}) exports names of security-relevant functions, they keep their usual meaning: ${dropped.join(', ')}`);
		}
		if(safe !== undefined) {
			this.recovered.set(safe.name, safe);
			this.source = undefined;
		}
		return safe;
	}

	public process(ctx: FlowrAnalyzerContext): void {
		const opts = this.optionsOf(ctx.config);
		if(!opts.enabled) {
			return;
		}
		ctx.deps.addLazyResolver((name, existing) => {
			if(existing?.namespaceInfo !== undefined || !FlowrAnalyzerPackageVersionsOnDemandPlugin.wanted(opts, name)) {
				return undefined;
			}
			const known = this.recovered.get(name);
			const cached = known === undefined ? this.recovererOf(ctx, opts).cached(name) : undefined;
			const pkg = known ?? (cached === undefined ? undefined : this.remember(ctx, cached));
			return pkg === undefined ? undefined : packageFromExports(name, { ...pkg, version: pkg.version ?? '' }, ctx.env.statedFor(name)?.keys());
		});
	}

	public override async prepare(ctx: FlowrAnalyzerContext, ast: NormalizedAst): Promise<void> {
		const opts = this.optionsOf(ctx.config);
		if(!opts.enabled || (SecureMode.isEnabled() && !opts.offline)) {
			return;
		}
		const { names, github } = packagesNamedIn(ast);
		const remotes = new Map([...descriptionRemotes(ctx), ...github, ...Object.entries(opts.repositories ?? {})]);
		const known = ctx.deps.signatures();
		const requests: PackageRequest[] = [...names]
			.filter(n => FlowrAnalyzerPackageVersionsOnDemandPlugin.wanted(opts, n) && !this.recovered.has(n) && !known.has(n))
			.map(n => ({ name: n, version: ctx.deps.getDependency(n)?.resolvedVersion, github: remotes.get(n) }));
		if(requests.length === 0) {
			return;
		}
		if(!TreeSitterExecutor.isInitialized()) {
			await TreeSitterExecutor.initTreeSitter(ctx.config.engines.find((e): e is TreeSitterEngineConfig => e.type === 'tree-sitter'));
		}
		for(const pkg of await this.recovererOf(ctx, opts).recover(requests)) {
			this.remember(ctx, pkg);
		}
	}

	public override signatureSources(): readonly PackageSignatureSource[] {
		if(this.recovered.size === 0) {
			return [];
		}
		this.source ??= new MemorySignatureSource(new Map([...this.recovered].map(([name, p]) => [name, {
			version: p.version, exported: p.exported, s4Classes: p.s4Classes, functions: p.functions
		}])));
		return [this.source];
	}

	public override packagesExporting(name: string): readonly string[] {
		return [...this.recovered.values()].filter(p => p.exported.includes(name)).map(p => p.name);
	}
}
