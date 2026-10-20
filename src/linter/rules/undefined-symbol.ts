import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { UnknownSideEffect } from '../../dataflow/graph/graph';
import { Identifier } from '../../dataflow/environments/identifier';
import { Q } from '../../search/flowr-search-builder';
import { F } from '../../search/flowr-search-filters';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { FileRole } from '../../project/context/flowr-file';
import { AttachedBasePackages, BaseDatasets, baseRExportOwner } from '../../util/r-base-packages';
import { nonBaseImports } from './unused-import';
import type { RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { memoize } from '../../util/collections/defaultmap';
import { type LintingResult, type LintingRule, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { collectScopeDefinedNames, isDefinedInEnclosingScope, isInstalledResourceFile, isInSubscript, isNonStandardEvaluated, useResolvesToDefinitionOrBuiltin } from './undefined-symbol-util';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

/** whether the flagged symbol is used in a function-call position or as a plain variable */
export type UndefinedSymbolKind = 'function' | 'variable';

export interface UndefinedSymbolResult extends LintingResult {
	/** the name that could not be resolved */
	name:                 string
	/** whether the name is used as a function call or as a variable read */
	kind:                 UndefinedSymbolKind
	/** packages that export this name - a hint that a `library()`/`::` might be missing (empty if none known) */
	availableInPackages?: readonly string[]
}

export interface UndefinedSymbolConfig extends MergeableRecord {
	/** flag names used in a function-call position that cannot be resolved (default `true`) */
	checkFunctions:  boolean
	/**
	 * flag names used as a variable read that cannot be resolved (default `true`). Formulas and data-masking
	 * (dplyr/tidyr/ggplot, `subset`/`with`) are recognised via flowR's dataflow, so this is precise; residual
	 * false positives are possible in dynamic `eval`/`attach`.
	 */
	checkVariables:  boolean
	/**
	 * flag unresolved symbols used as `[`/`[[` subscripts (default `false`). Off by default to mute
	 * `data.table`'s `DT[i, j, by]` column masking, which flowR cannot distinguish from ordinary indexing.
	 */
	checkSubscripts: boolean
}

/** Why unresolved candidates were suppressed instead of reported, kept in the metadata for auditability. */
export interface SuppressionCounts {
	/** file below `inst/` (installed resource, not namespace source) */
	installed:         number
	/** exported by a package in scope: a loaded/DESCRIPTION package or a default-attached base package */
	loadedPackage:     number
	/** unconditionally bound in an enclosing scope that flowR's dataflow did not statically link */
	enclosingScope:    number
	/** consumed by non-standard evaluation (a quoting edge) */
	nonStandardEval:   number
	/** used as a `[`/`[[` subscript (muted `data.table`-style column masking) */
	subscript:         number
	/** a bare name a `library()` flowR could not resolve may export */
	unresolvedLibrary: number
	/** declared by `utils::globalVariables()` or set by R's method dispatch (`.Generic`, `.Method`, `.Class`) */
	declaredGlobal:    number
}

export interface UndefinedSymbolMetadata extends MergeableRecord {
	totalFunctionCalls: number
	totalVariableUses:  number
	/** breakdown of unresolved candidates that were suppressed rather than reported */
	suppressed:         SuppressionCounts
}

/** the variables R's S3 dispatch binds in the frame of a method */
const DispatchVariables = ['.Generic', '.Method', '.Class'] as const;

/**
 * The names declared by the `utils::globalVariables(names)` calls of the code (resolved by flowR), which is how a
 * package tells `R CMD check` about names it uses through non-standard evaluation, and the variables of R's dispatch.
 */
function declaredGlobalVariables(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): ReadonlySet<string> {
	const names = new Set<string>(DispatchVariables);
	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const [name, ns] = Identifier.toArray(vertex.name);
		if(name !== 'globalVariables' || (ns !== undefined && ns !== 'utils')) {
			continue;
		}
		const values = getArgumentStringValue(ctx.config.solver.variables, graph, vertex, 0, 'names', true, ctx);
		for(const str of values?.values().flatMap(v => [...v]) ?? []) {
			if(str !== undefined) {
				names.add(str);
			}
		}
	}
	return names;
}

/** calls that load a package; an unresolved one means we cannot enumerate all exports in scope */
const LibraryLoadFunctions = new Set(['library', 'require', 'requireNamespace', 'loadNamespace', 'attachNamespace', 'load_all', 'use', 'p_load']);

/** test frameworks whose namespace a test file runs under implicitly (e.g. `tests/testthat/test-*.R` sees testthat's exports without a `library()`) */
const ImplicitTestFrameworks = ['testthat', 'tinytest', 'RUnit'];

/** whether name is an export of a default-attached base package (needs no library()) */
function isAttachedBaseName(name: string): boolean {
	if(BaseDatasets.has(name)) {
		return true;
	}
	const owner = baseRExportOwner(name);
	return owner !== undefined && AttachedBasePackages.includes(owner);
}

/** upper bound on the number of packages named in a "did you forget to load it" hint */
const MaxHintPackages = 5;

/**
 * Flags function calls (`sd()`) and, opt-in, variable reads (`x`) that are neither defined locally, a
 * builtin, nor exported by a package in scope - the DESCRIPTION/`library()` packages plus the default-attached
 * base packages, all resolved from the `flowr-sigdb` database. To stay precise it consults flowR's dataflow:
 * non-standard evaluation (quoting) is not reported, and an unloaded package that exports the name is offered
 * as a hint. Over-approximative: NSE beyond what flowR models can still cause false positives.
 */
export const UNDEFINED_SYMBOL = {
	createSearch:        (_config: UndefinedSymbolConfig) => Q.all().filter(F.or(VertexType.FunctionCall, VertexType.Use)),
	processSearchResult: async(elements, config, data) => {
		const graph = (await data.dataflow()).graph;
		const ctx = data.inspectContext();
		const deps = ctx.deps;
		const meta: UndefinedSymbolMetadata = {
			totalFunctionCalls: 0,
			totalVariableUses:  0,
			suppressed:         { installed: 0, loadedPackage: 0, enclosingScope: 0, nonStandardEval: 0, subscript: 0, unresolvedLibrary: 0, declaredGlobal: 0 }
		};
		const suppress = (reason: keyof SuppressionCounts): undefined => {
			meta.suppressed[reason]++;
			return undefined;
		};

		// `inst/` files are installed verbatim (resources, not namespace source); skip them. Key off the
		// FileRole.Install role, with a path fallback for requests that bypass the file-role plugins.
		const installedFiles = new Set(ctx.files.getFilesByRole(FileRole.Install).map(f => f.path()));
		const isInstalledFile = (file: string | undefined): boolean =>
			file !== undefined && (installedFiles.has(file) || isInstalledResourceFile(file));

		// test files run under their framework's attached namespace, so a bare name a test framework exports is defined there
		const testFiles = new Set(ctx.files.getFilesByRole(FileRole.Test).map(f => f.path()));
		const testExports = new Set(testFiles.size === 0 ? [] : deps.signatureSources().flatMap(
			src => ImplicitTestFrameworks.flatMap(pkg => src.lookup(pkg)?.exported ?? [])));
		const isImplicitTestExport = (name: string, file: string | undefined): boolean =>
			file !== undefined && testFiles.has(file) && testExports.has(name);

		/* a library() we could not resolve could export any bare name, so such names are suppressed rather than guessed */
		const unknownIds = new Set([...graph.unknownSideEffects].map(e => UnknownSideEffect.id(e)));
		const unresolvedLibraryInScope = unknownIds.size > 0 && [...graph.verticesOfType(VertexType.FunctionCall)]
			.some(([id, v]) => unknownIds.has(id) && LibraryLoadFunctions.has(Identifier.getName(v.name)));

		// names a package declares global (`utils::globalVariables`) are no undefined symbols to R CMD check either
		const declaredGlobals = declaredGlobalVariables(graph, ctx);

		// scope-defined names, a fallback for closure variables flowR's dataflow did not statically link
		const scopeDefined = collectScopeDefinedNames(graph);

		// packages whose exports are in scope: DESCRIPTION/library() deps plus the default-attached base
		// packages, each resolved (exports enriched) from the package database via getDependency
		const loadedPackages = [
			...deps.getDependencies().map(p => deps.getDependency(p.name) ?? p),
			...AttachedBasePackages.map(n => deps.getDependency(n)).filter(isNotUndefined)
		];

		/* a package may re-export what it imports, as dplyr does tibble's `as_tibble` */
		const src = deps.signatures().sources();
		const importedByLoaded = new Set(loadedPackages.flatMap(p => src.isBaseR(p.name) ? [] : nonBaseImports(src, p.name, p.resolvedVersion)));
		const isExportedByLoadedPackage = memoize((name: string): boolean =>
			loadedPackages.some(p => p.has(name)) || (importedByLoaded.size > 0 && deps.packagesExporting(name).some(p => importedByLoaded.has(p))));

		// hint an unloaded package that exports `name` (e.g. `ggplot` -> `ggplot2`), from the package database
		const attached = new Set(AttachedBasePackages);
		const hintPackagesFor = (name: string): string[] =>
			deps.packagesExporting(name).filter(p => !attached.has(p)).slice(0, MaxHintPackages);

		/** shared resolution logic for a name used either as a function call or a variable */
		const check = (node: RNodeWithParent, name: string, namespace: string | undefined, kind: UndefinedSymbolKind): UndefinedSymbolResult | undefined => {
			const id = node.info.id;
			// resolved by flowR itself (local/param/builtin) - never a candidate, so not counted as suppressed
			if(kind === 'variable' ? useResolvesToDefinitionOrBuiltin(graph, id) : (Dataflow.origin(graph, id)?.length ?? 0) > 0) {
				return undefined;
			}
			// a bare call to a registered flowR builtin whose dataflow origin was rewritten away from its
			// builtin marker (e.g. a fully-resolved `UseMethod` dispatch is re-tagged as a plain function
			// call) is still defined, so recognise it directly from the built-in environment
			if(kind === 'function' && namespace === undefined && ctx.env.builtInEnvironment.memory.has(name)) {
				return undefined;
			}
			// a bare name from a default-attached base package (or a primitive) is defined without a library() call,
			// and `base::name` (or any other base package) is known to flowR without a signature database
			if(namespace === undefined ? isAttachedBaseName(name) : baseRExportOwner(name) === namespace) {
				return undefined;
			}
			// a bare name a test framework exports, used in a test file where that framework's namespace is attached
			if(namespace === undefined && isImplicitTestExport(name, node.info.file)) {
				return suppress('loadedPackage');
			}
			// exported by a package in scope (`pkg::fn`, a loaded package, or a default-attached base package)
			/* the database records no data sets, so `pkg::x` read as a variable may be lazy data of a known package */
			const nsPackage = namespace === undefined ? undefined : deps.getDependency(namespace);
			const exported = namespace === undefined
				? isExportedByLoadedPackage(name)
				: nsPackage !== undefined && (kind === 'variable' || nsPackage.has(name));
			if(exported) {
				return suppress('loadedPackage');
			}
			// declared global (as R CMD check honors it) or bound by R's method dispatch
			if(namespace === undefined && declaredGlobals.has(name)) {
				return suppress('declaredGlobal');
			}
			// forward-referenced closure binding flowR's dataflow did not link (unconditional bindings only)
			if(isDefinedInEnclosingScope(graph, scopeDefined, id, name)) {
				return suppress('enclosingScope');
			}
			// consumed by non-standard evaluation (quoting), hence not an ordinary read
			if(isNonStandardEvaluated(graph, id)) {
				return suppress('nonStandardEval');
			}
			// `[`/`[[` subscript: muted by default (indistinguishable from `data.table` column masking)
			if(kind === 'variable' && !config.checkSubscripts && isInSubscript(graph, id)) {
				return suppress('subscript');
			}
			if(unresolvedLibraryInScope && namespace === undefined) {
				return suppress('unresolvedLibrary');
			}
			const loc = SourceLocation.fromNode(node);
			if(loc === undefined) {
				return undefined;
			}
			const availableInPackages = namespace === undefined ? hintPackagesFor(name) : [];
			return {
				certainty:  LintingResultCertainty.Uncertain,
				name,
				kind,
				involvedId: id,
				loc,
				...(availableInPackages.length > 0 ? { availableInPackages } : {})
			} satisfies UndefinedSymbolResult;
		};

		/** the symbol to check if the config asks for it: a called function, or a plain symbol read */
		const symbolOf = (node: RNodeWithParent): [UndefinedSymbolKind, Identifier] | undefined => {
			const vtx = graph.getVertex(node.info.id);
			if(DfgVertex.isFunctionCall(vtx)) {
				return vtx.origin !== 'unnamed' && config.checkFunctions ? ['function', vtx.name] : undefined;
			}
			const plainSymbol = RSymbol.is(node) && node.lexeme !== '...' && node.lexeme !== undefined;
			return DfgVertex.isUse(vtx) && config.checkVariables && plainSymbol ? ['variable', node.content] : undefined;
		};

		const results = elements.getElements().map(({ node }) => {
			const symbol = symbolOf(node);
			if(symbol === undefined) {
				return undefined;
			}
			const [kind, identifier] = symbol;
			meta[kind === 'function' ? 'totalFunctionCalls' : 'totalVariableUses']++;
			if(isInstalledFile(node.info.file)) {
				return suppress('installed');
			}
			return check(node, Identifier.getName(identifier), Identifier.getNamespace(identifier), kind);
		}).filter(isNotUndefined);
		return { results, '.meta': meta };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Undefined ${result.kind} \`${result.name}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => {
			const where = SourceLocation.format(result.loc);
			if(result.availableInPackages && result.availableInPackages.length > 0) {
				const pkgs = result.availableInPackages.map(p => `\`${p}\``).join(', ');
				const hint = result.availableInPackages.length === 1 ? `\`library(${result.availableInPackages[0]})\`` : `one of ${pkgs}`;
				return `\`${result.name}\` at ${where} is used but not defined; it is exported by ${pkgs} - did you forget to load it (e.g. ${hint})?`;
			}
			return result.kind === 'function'
				? `\`${result.name}\` at ${where} is called but is neither defined locally, a base R builtin, nor exported by a loaded package`
				: `\`${result.name}\` at ${where} is used as a variable but is never defined in scope`;
		}
	},
	info: {
		name:          'Undefined Symbol',
		certainty:     LintingRuleCertainty.OverApproximative,
		description:   'Finds functions and variables that are neither defined locally, a base R builtin, nor exported by a loaded package.',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Experimental],
		defaultConfig: () => ({
			checkFunctions:  true,
			checkVariables:  true,
			checkSubscripts: false
		})
	}
} as const satisfies LintingRule<UndefinedSymbolResult, UndefinedSymbolMetadata, UndefinedSymbolConfig>;
