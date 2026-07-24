import { VertexType, isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { UnknownSideEffect } from '../../dataflow/graph/graph';
import { getOriginInDfg } from '../../dataflow/origin/dfg-get-origin';
import { Identifier } from '../../dataflow/environments/identifier';
import { Q } from '../../search/flowr-search-builder';
import { F } from '../../search/flowr-search-filters';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { FileRole } from '../../project/context/flowr-file';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { baseRExportOwner } from '../../util/r-base-packages';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearchElement } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type LintingResult, type LintingRule, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import {
	collectScopeDefinedNames,
	isDefinedInEnclosingScope,
	isInstalledResourceFile,
	isInSubscript,
	isNonStandardEvaluated,
	useResolvesToDefinitionOrBuiltin
} from './undefined-symbol-util';

/** whether the flagged symbol is used in a function-call position or as a plain variable */
export type UndefinedSymbolKind = 'function' | 'variable';

export interface UndefinedSymbolResult extends LintingResult {
	/** the name that could not be resolved */
	name:                              string
	/** whether the name is used as a function call or as a variable read */
	kind:                              UndefinedSymbolKind
	/** packages that export this name - a hint that a `library()`/`::` might be missing (empty if none known) */
	availableInPackages?:              readonly string[]
	/** an unresolved `library()` is in scope that could define this name; treat as low-confidence */
	mayBeProvidedByUnresolvedLibrary?: boolean
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
	installed:       number
	/** exported by a package in scope: a loaded/DESCRIPTION package or a default-attached base package */
	loadedPackage:   number
	/** unconditionally bound in an enclosing scope that flowR's dataflow did not statically link */
	enclosingScope:  number
	/** consumed by non-standard evaluation (a quoting edge) */
	nonStandardEval: number
	/** used as a `[`/`[[` subscript (muted `data.table`-style column masking) */
	subscript:       number
}

export interface UndefinedSymbolMetadata extends MergeableRecord {
	totalFunctionCalls: number
	totalVariableUses:  number
	/** breakdown of unresolved candidates that were suppressed rather than reported */
	suppressed:         SuppressionCounts
}

/** calls that load a package; an unresolved one means we cannot enumerate all exports in scope */
const LibraryLoadFunctions = new Set(['library', 'require', 'requireNamespace', 'loadNamespace', 'attachNamespace', 'load_all', 'use', 'p_load']);

// standard packages attached by default; exports are in scope without library()
const AttachedBasePackages = ['base', 'stats', 'graphics', 'grDevices', 'utils', 'datasets', 'methods'];

/** test frameworks whose namespace a test file runs under implicitly (e.g. `tests/testthat/test-*.R` sees testthat's exports without a `library()`) */
const ImplicitTestFrameworks = new Set(['testthat', 'tinytest', 'RUnit']);

/** whether name is an export of a default-attached base package (needs no library()) */
function isAttachedBaseName(name: string): boolean {
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
			suppressed:         { installed: 0, loadedPackage: 0, enclosingScope: 0, nonStandardEval: 0, subscript: 0 }
		};

		// `inst/` files are installed verbatim (resources, not namespace source); skip them. Key off the
		// FileRole.Install role, with a path fallback for requests that bypass the file-role plugins.
		const installedFiles = new Set(ctx.files.getFilesByRole(FileRole.Install).map(f => f.path()));
		const isInstalledFile = (file: string | undefined): boolean =>
			file !== undefined && (installedFiles.has(file) || isInstalledResourceFile(file));

		// test files run under their framework's attached namespace, so a bare name a test framework exports is defined there
		const testFiles = new Set(ctx.files.getFilesByRole(FileRole.Test).map(f => f.path()));
		const isImplicitTestExport = (name: string, file: string | undefined): boolean =>
			file !== undefined && testFiles.has(file) && deps.packagesExporting(name).some(p => ImplicitTestFrameworks.has(p));

		// a library() we could not resolve could export any of these symbols; we still report but flag the
		// findings as low-confidence (`mayBeProvidedByUnresolvedLibrary`) so the severity can be lowered
		const unknownIds = new Set<NodeId>();
		for(const e of graph.unknownSideEffects) {
			unknownIds.add(UnknownSideEffect.id(e));
		}
		let unresolvedLibraryInScope = false;
		if(unknownIds.size > 0) {
			for(const [id, v] of graph.verticesOfType(VertexType.FunctionCall)) {
				if(LibraryLoadFunctions.has(Identifier.getName(v.name)) && unknownIds.has(id)) {
					unresolvedLibraryInScope = true;
					break;
				}
			}
		}

		// scope-defined names, a fallback for closure variables flowR's dataflow did not statically link
		const scopeDefined = collectScopeDefinedNames(graph);

		// packages whose exports are in scope: DESCRIPTION/library() deps plus the default-attached base
		// packages, each resolved (exports enriched) from the package database via getDependency
		const loadedPackages = [
			...deps.getDependencies().map(p => deps.getDependency(p.name) ?? p),
			...AttachedBasePackages.map(n => deps.getDependency(n)).filter(isNotUndefined)
		];

		// hint an unloaded package that exports `name` (e.g. `ggplot` -> `ggplot2`), from the package database
		const attached = new Set(AttachedBasePackages);
		const hintPackagesFor = (name: string): string[] =>
			deps.packagesExporting(name).filter(p => !attached.has(p)).slice(0, MaxHintPackages);

		const results = elements.getElements().map(element => {
			const id = element.node.info.id;
			const vtx = graph.getVertex(id);
			if(!vtx) {
				return undefined;
			}
			const inInstalledFile = isInstalledFile(element.node.info.file);

			if(isFunctionCallVertex(vtx)) {
				if(vtx.origin === 'unnamed' || !config.checkFunctions) {
					return undefined;
				}
				meta.totalFunctionCalls++;
				if(inInstalledFile) {
					meta.suppressed.installed++;
					return undefined;
				}
				return check(element, id, Identifier.getName(vtx.name), Identifier.getNamespace(vtx.name), 'function');
			}

			// variable use: only plain symbols (not argument names, `...`, or empty)
			if(vtx.tag === VertexType.Use && config.checkVariables) {
				const node = element.node;
				if(node.type !== RType.Symbol || node.lexeme === '...' || node.lexeme === undefined) {
					return undefined;
				}
				meta.totalVariableUses++;
				if(inInstalledFile) {
					meta.suppressed.installed++;
					return undefined;
				}
				return check(element, id, node.lexeme, undefined, 'variable');
			}
			return undefined;
		}).filter(isNotUndefined);

		/** shared resolution logic for a name used either as a function call or a variable */
		function check(element: FlowrSearchElement<ParentInformation>, id: NodeId, name: string, namespace: string | undefined, kind: UndefinedSymbolKind): UndefinedSymbolResult | undefined {
			// resolved by flowR itself (local/param/builtin) - never a candidate, so not counted as suppressed
			if(kind === 'variable' ? useResolvesToDefinitionOrBuiltin(graph, id) : (getOriginInDfg(graph, id)?.length ?? 0) > 0) {
				return undefined;
			}
			// a bare call to a registered flowR builtin whose dataflow origin was rewritten away from its
			// builtin marker (e.g. a fully-resolved `UseMethod` dispatch is re-tagged as a plain function
			// call) is still defined, so recognise it directly from the built-in environment
			if(kind === 'function' && namespace === undefined && ctx.env.builtInEnvironment.memory.has(name)) {
				return undefined;
			}
			// a bare name from a default-attached base package (or a primitive) is defined without a library() call
			if(namespace === undefined && isAttachedBaseName(name)) {
				return undefined;
			}
			// a bare name a test framework exports, used in a test file where that framework's namespace is attached
			if(namespace === undefined && isImplicitTestExport(name, element.node.info.file)) {
				return suppress('loadedPackage');
			}
			// exported by a package in scope (`pkg::fn`, a loaded package, or a default-attached base package)
			if(namespace !== undefined ? deps.getDependency(namespace)?.has(name) === true : loadedPackages.some(p => p.has(name))) {
				return suppress('loadedPackage');
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
			const loc = SourceLocation.fromNode(element.node);
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
				...(availableInPackages.length > 0 ? { availableInPackages } : {}),
				...(unresolvedLibraryInScope ? { mayBeProvidedByUnresolvedLibrary: true } : {})
			} satisfies UndefinedSymbolResult;
		}

		function suppress(reason: keyof SuppressionCounts): undefined {
			meta.suppressed[reason]++;
			return undefined;
		}

		return { results, '.meta': meta };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.mayBeProvidedByUnresolvedLibrary ? 'Possibly undefined' : 'Undefined'} ${result.kind} \`${result.name}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => {
			const where = SourceLocation.format(result.loc);
			const caveat = result.mayBeProvidedByUnresolvedLibrary ? ' (an unresolved library is loaded that might provide it)' : '';
			if(result.availableInPackages && result.availableInPackages.length > 0) {
				const pkgs = result.availableInPackages.map(p => `\`${p}\``).join(', ');
				const hint = result.availableInPackages.length === 1 ? `\`library(${result.availableInPackages[0]})\`` : `one of ${pkgs}`;
				return `\`${result.name}\` at ${where} is used but not defined; it is exported by ${pkgs} - did you forget to load it (e.g. ${hint})?${caveat}`;
			}
			return result.kind === 'function'
				? `\`${result.name}\` at ${where} is called but is neither defined locally, a base R builtin, nor exported by a loaded package${caveat}`
				: `\`${result.name}\` at ${where} is used as a variable but is never defined in scope${caveat}`;
		}
	},
	info: {
		name:          'Undefined Symbol',
		certainty:     LintingRuleCertainty.OverApproximative,
		description:   'Flags functions and variables that are neither defined locally, a base R builtin, nor exported by a loaded package.',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Experimental],
		defaultConfig: {
			checkFunctions:  true,
			checkVariables:  true,
			checkSubscripts: false
		}
	}
} as const satisfies LintingRule<UndefinedSymbolResult, UndefinedSymbolMetadata, UndefinedSymbolConfig>;
