import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { callFnProps } from '../../../dataflow/environments/query-fn-props';
import { ArgProp, CallProps, type FnSig, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RForLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RRepeatLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { isExportedInInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { calledDefinitions, type CmdCheckResult, formalNames, packageInfo, topLevelDefinitions } from './cmd-check-util';

/** what is wrong with a package hook */
export type PackageHookIssue =
	| 'arguments'
	| 'search-path'
	| 'output'
	| 'unsafe-call'
	| 'misplaced-call'
	| 'obsolete'
	| 'unexported';

export interface PackageHooksResult extends CmdCheckResult {
	/** the hook, e.g. `.onLoad` */
	readonly hook:  string
	readonly issue: PackageHookIssue
	/** the offending function called, if the issue is a call */
	readonly call?: string
}

export interface PackageHooksConfig extends MergeableRecord {
	/** functions that print startup messages the way R wants them to, which are only allowed in `.onAttach` */
	readonly startupMessageFunctions: readonly string[]
	/** functions that may emit output in a startup hook nonetheless, as the user can silence them otherwise (default `warning`) */
	readonly allowedOutput:           readonly string[]
	/** functions too costly or unsafe to call in a startup hook (default `installed.packages`) */
	readonly unsafeCalls:             readonly string[]
	/** also report what the hook does through functions of the package it calls, which `R CMD check` does not see (default `true`) */
	readonly followCalls:             boolean
}

export interface PackageHooksMetadata extends MergeableRecord {
	/** the hooks the package defines */
	readonly hooks: readonly string[]
}

/** the hooks R calls as the package is loaded or attached */
const StartupHooks: ReadonlySet<string> = new Set(['.onLoad', '.onAttach', '.First.lib']);
/** the hooks R calls as the package is detached */
const DetachHooks: ReadonlySet<string> = new Set(['.onDetach', '.Last.lib']);
/** the calls that belong into another hook: where they are wrong and where they belong */
const MisplacedCalls: Readonly<Record<string, { readonly in: readonly string[], readonly instead: string }>> = {
	'library.dynam':        { in: ['.onAttach'], instead: '.onLoad' },
	'library.dynam.unload': { in: ['.onDetach', '.Last.lib'], instead: '.onUnload' }
};

interface ReachedCall {
	readonly id:   NodeId
	readonly name: string
	/** the call of a package function through which the call is reached, `undefined` if it is in the hook itself */
	readonly via?: NodeId
}

/** the constructs whose body may or may not run */
function isConditional(node: RNode<ParentInformation>): boolean {
	return RIfThenElse.is(node) || RWhileLoop.is(node) || RForLoop.is(node) || RRepeatLoop.is(node) || RFunctionCall.isNamed(node, 'switch') || RFunctionCall.isNamed(node, 'tryCatch');
}

/**
 * Every call made within the given definition and, if asked, within the package functions it calls (transitively).
 * Of a function the hook calls, only the calls it makes in any case count: one guarded by an `if` (an option
 * asking for verbose output, say) is no output of the hook.
 */
function reachedCalls(def: RFunctionDefinition<ParentInformation>, df: DataflowInformation, idMap: AstIdMap, follow: boolean): ReachedCall[] {
	const result: ReachedCall[] = [];
	const visited = new Set<NodeId>([def.info.id]);
	const work: { def: RFunctionDefinition<ParentInformation>, via?: NodeId }[] = [{ def }];
	for(let item = work.pop(); item !== undefined; item = work.pop()) {
		const { via } = item;
		let conditional = 0;
		RNode.visitAst(item.def.body, node => {
			if(via !== undefined && (isConditional(node) || RFunctionDefinition.is(node))) {
				conditional++;
			}
			const vertex = df.graph.getVertex(node.info.id);
			if(!DfgVertex.isFunctionCall(vertex) || conditional > 0) {
				return false;
			}
			result.push({ id: node.info.id, name: Identifier.getName(vertex.name), via });
			for(const callee of follow ? calledDefinitions(df.graph, node.info.id, idMap) : []) {
				if(!visited.has(callee.info.id)) {
					visited.add(callee.info.id);
					work.push({ def: callee, via: via ?? node.info.id });
				}
			}
			return false;
		}, node => {
			if(via !== undefined && (isConditional(node) || RFunctionDefinition.is(node))) {
				conditional--;
			}
		});
	}
	return result;
}

/** whether the call writes to a resource it is handed (`cat(x, file = f)`, `writeLines(x, con)`) rather than to the console */
function writesToResource(id: NodeId, df: DataflowInformation, sig: FnSig | undefined): boolean {
	const vertex = df.graph.getVertex(id);
	const resources = sig?.filter(([, p]) => (p & ArgProp.Resource) !== 0).map(([n]) => n) ?? [];
	if(!DfgVertex.isFunctionCall(vertex) || resources.length === 0) {
		return false;
	}
	const bound = FunctionSemantics.call.match.toSpec(vertex.args, Object.fromEntries((sig ?? []).map(([n]) => [n, n])));
	return resources.some(r => (bound.get(r)?.length ?? 0) > 0);
}

/** whether the call states an argument named `name` */
function hasNamedArgument(id: NodeId, df: DataflowInformation, name: string): boolean {
	const vertex = df.graph.getVertex(id);
	return DfgVertex.isFunctionCall(vertex) && vertex.args.some(a => a !== EmptyArgument && a.name === name);
}

/**
 * Port of the `R CMD check` notes on package hooks (`checking R code for possible problems`, from
 * `tools:::.check_package_code_startup_functions` and `tools:::.check_package_code_unload_functions`).
 */
export const PACKAGE_HOOKS = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const pkg = packageInfo(data.inspectContext());
		const hooks = topLevelDefinitions(ast, n => StartupHooks.has(n) || DetachHooks.has(n))
			.filter(h => pkg.isPackageCode(h.def.info.file));
		const results: PackageHooksResult[] = [];
		const startupMessages = new Set(config.startupMessageFunctions);
		const allowedOutput = new Set(config.allowedOutput);
		const unsafe = new Set(config.unsafeCalls);
		for(const { name: hook, def } of hooks) {
			const defLoc = SourceLocation.fromNode(def) ?? SourceLocation.invalid();
			const report = (issue: PackageHookIssue, message: string, id: NodeId = def.info.id, call?: string, certain = true) => results.push({
				certainty:  certain ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain,
				involvedId: id,
				loc:        id === def.info.id ? defLoc : SourceLocation.fromNode(idMap.get(id)) ?? defLoc,
				hook,
				issue,
				...(call ? { call } : {}),
				message
			});
			if(hook === '.First.lib') {
				report('obsolete', '.First.lib is obsolete and will not be used in R >= 3.0.0, use .onLoad or .onAttach instead');
			} else if(hook === '.Last.lib' && pkg.namespace !== undefined && isExportedInInfo(hook, pkg.namespace) === false) {
				report('unexported', '.Last.lib will not be used unless it is exported, use .onDetach or .onUnload instead');
			}
			const formals = formalNames(def);
			if(StartupHooks.has(hook) && !formals.includes('...') && (formals.length !== 2 || !formals[0].startsWith('lib') || !formals[1].startsWith('pkg'))) {
				report('arguments', `${hook} has the argument list (${formals.join(', ')}) but package startup functions should have two arguments with names starting with 'lib' and 'pkg', respectively`);
			} else if(DetachHooks.has(hook) && !formals.includes('...') && (formals.length !== 1 || !formals[0].startsWith('lib'))) {
				report('arguments', `${hook} has the argument list (${formals.join(', ')}) but package detach functions should have one argument with a name starting with 'lib'`);
			}
			for(const { id, name, via } of reachedCalls(def, df, idMap, config.followCalls)) {
				const through = via === undefined ? '' : ` (through the call at ${SourceLocation.format(SourceLocation.fromNode(idMap.get(via)))})`;
				const at = via ?? id;
				const misplaced = MisplacedCalls[name];
				if(misplaced?.in.includes(hook)) {
					report('misplaced-call', `${hook} should not call ${name}, which belongs into ${misplaced.instead}${through}`, at, name, via === undefined);
					continue;
				}
				if(!StartupHooks.has(hook)) {
					continue;
				}
				const props = callFnProps(id, df);
				if(unsafe.has(name)) {
					report('unsafe-call', `Package startup functions should not call ${name}${through}`, at, name, via === undefined);
				} else if(CallProps.hasAny(props, SemanticCallTag.AttachesPackage) && !hasNamedArgument(id, df, 'help')) {
					report('search-path', `Package startup functions should not change the search path, but ${hook} calls ${name}${through}`, at, name, via === undefined);
				} else if(startupMessages.has(name) ? hook === '.onLoad' : CallProps.hasAny(props, SemanticCallTag.Prints) && !allowedOutput.has(name) && !writesToResource(id, df, props?.sig)) {
					report('output', hook === '.onLoad' && startupMessages.has(name)
						? `.onLoad should not print startup messages with ${name}, use .onAttach instead${through}`
						: `Package startup functions should use ${config.startupMessageFunctions[0] ?? 'packageStartupMessage'} to generate messages, but ${hook} calls ${name}${through}`, at, name, via === undefined);
				}
			}
		}
		return { results, '.meta': { hooks: hooks.map(h => h.name) } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.hook}: ${result.issue}${result.call ? ` (${result.call})` : ''} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Package Hooks',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Usability],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks `.onLoad`, `.onAttach`, `.onDetach`, and `.Last.lib`: argument lists, attaching packages, output other than `packageStartupMessage()`, `installed.packages()`, misplaced `library.dynam()` calls, and the obsolete `.First.lib`. Follows calls into the package\'s own functions.',
		defaultConfig: () => ({
			startupMessageFunctions: ['packageStartupMessage'],
			allowedOutput:           ['warning'],
			unsafeCalls:             ['installed.packages'],
			followCalls:             true
		})
	}
} as const satisfies LintingRule<PackageHooksResult, PackageHooksMetadata, PackageHooksConfig>;
