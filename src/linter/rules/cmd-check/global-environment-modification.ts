import { type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNumber } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { Identifier } from '../../../dataflow/environments/identifier';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { StackEnvKind } from '../../../dataflow/environments/default-builtin-config';
import { stackEnvKindOf } from '../../../dataflow/internal/process/functions/call/built-in/built-in-stack-env';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RFunctionCall, EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowInformation } from '../../../dataflow/info';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { REnvironmentInformation } from '../../../dataflow/environments/environment';
import { at, boundName, type CmdCheckResult, packageCalls, packageInfo, printer, projectNodes } from './cmd-check-util';
import { RForLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';

/** how the code changes the global environment or the search path */
export type GlobalEnvironmentModificationKind =
	/** `assign(..., envir = globalenv())` */
	| 'assign'
	/** `data(...)` loading into the global environment */
	| 'data'
	/** `attach(...)` */
	| 'attach'
	/** `x <<- v` without a binding of `x` in an enclosing function, which creates (or changes) a global variable */
	| 'global-superassignment'
	/** `x <<- v` targeting a variable of the package namespace, whose binding is locked once the package is loaded */
	| 'locked-superassignment';

export interface GlobalEnvironmentModificationResult extends CmdCheckResult {
	readonly kind:      GlobalEnvironmentModificationKind
	/** the variable written, if known */
	readonly variable?: string
}

export interface GlobalEnvironmentModificationConfig extends MergeableRecord {
	/** report `<<-` assignments that reach the global environment or a locked namespace binding (default `true`) */
	readonly checkSuperAssignments: boolean
	/** variables that may be assigned in the global environment (default `.Random.seed`, as `R CMD check` allows) */
	readonly allowedGlobals:        readonly string[]
}

export interface GlobalEnvironmentModificationMetadata extends MergeableRecord {
	/** calls of `assign`, `data` and `attach` inspected */
	readonly consideredCalls: number
}

/** the calls that may write into an environment they are handed, with the formals naming it */
const EnvironmentWriters = {
	assign: { x: 'x', value: 'value', pos: 'pos', envir: 'envir', inherits: 'inherits', immediate: 'immediate' },
	data:   { '...': '...', list: 'list', package: 'package', 'lib.loc': 'lib.loc', verbose: 'verbose', envir: 'envir', overwrite: 'overwrite' },
	attach: { what: 'what', pos: 'pos', name: 'name', 'warn.conflicts': 'warn.conflicts' }
} as const;

const WriterNames: ReadonlySet<string> = new Set(Object.keys(EnvironmentWriters));

/** whether `node` denotes the global environment, directly or through variables bound to it */
function denotesGlobalEnv(node: RNode<ParentInformation> | undefined, environment: REnvironmentInformation, df: DataflowInformation, idMap: AstIdMap, ctx: ReadOnlyFlowrAnalyzerContext, depth = 0): boolean {
	if(node === undefined || depth > 8) {
		return false;
	}
	if(stackEnvKindOf(node, { environment }) === StackEnvKind.Global) {
		return true;
	}
	/* `as.environment(1)`, `as.environment(".GlobalEnv")` */
	if(RFunctionCall.isNamed(node, 'as.environment') && node.arguments.length === 1 && node.arguments[0] !== EmptyArgument) {
		return denotesGlobalPos(node.arguments[0].value);
	}
	if(!RSymbol.is(node)) {
		return false;
	}
	const defs = [...df.graph.edgesFrom(node.info.id)].filter(([t, e]) => DfEdge.includesType(e, EdgeType.Reads) && !NodeId.isBuiltIn(t)).map(([t]) => t);
	return defs.length > 0 && defs.every(d => {
		const def = idMap.get(d);
		const assignment = def?.info.parent === undefined ? undefined : idMap.get(def.info.parent);
		const value = !RBinaryOp.is(assignment) ? undefined : assignment.lhs === def ? assignment.rhs : assignment.rhs === def ? assignment.lhs : undefined;
		return value !== undefined && denotesGlobalEnv(value, df.graph.getVertex(d)?.environment ?? environment, df, idMap, ctx, depth + 1);
	});
}

/** whether a `pos` argument names the global environment, which is the first entry of the search path */
function denotesGlobalPos(node: RNode<ParentInformation> | undefined): boolean {
	return (RNumber.is(node) && node.content.num === 1) || (RString.is(node) && node.content.str === '.GlobalEnv');
}

/** the variable an assignment target writes, looking through replacement calls and accesses (`names(x)`, `x$a`, `x[[1]]`) */
function targetVariable(lhs: RNode<ParentInformation>): string | undefined {
	switch(lhs.type) {
		case RType.Symbol:
			return Identifier.getName(lhs.content);
		case RType.String:
			return lhs.content.str;
		case RType.Access:
			return targetVariable(lhs.accessed);
		case RType.FunctionCall:
			return lhs.arguments[0] !== EmptyArgument && lhs.arguments[0]?.value !== undefined ? targetVariable(lhs.arguments[0].value) : undefined;
		default:
			return undefined;
	}
}

const LocalAssignments: ReadonlySet<string> = new Set(['<-', '=', '->']);

/**
 * The names a scope (a function definition or `local` call) binds itself: its parameters, the targets of its plain
 * assignments, its `for` variables, and the literal names it `assign`s; the functions nested in it bind their own.
 */
function localBindings(scope: RNode<ParentInformation>, memo: Map<NodeId, ReadonlySet<string>>): ReadonlySet<string> {
	const known = memo.get(scope.info.id);
	if(known !== undefined) {
		return known;
	}
	const names = new Set<string>(RFunctionDefinition.is(scope) ? scope.parameters.map(p => Identifier.getName(p.name.content)) : []);
	RNode.visitAst(RFunctionDefinition.is(scope) ? scope.body : scope, node => {
		if(RFunctionDefinition.is(node)) {
			return true;
		}
		const name = RBinaryOp.is(node) && LocalAssignments.has(node.operator) ? targetVariable(node.operator === '->' ? node.rhs : node.lhs)
			: RForLoop.is(node) ? Identifier.getName(node.variable.content)
				: RFunctionCall.isNamed(node, 'assign') && node.arguments[0] !== EmptyArgument && RString.is(node.arguments[0]?.value) ? node.arguments[0].value.content.str
					: undefined;
		if(name !== undefined) {
			names.add(name);
		}
		return false;
	});
	memo.set(scope.info.id, names);
	return names;
}

/** whether the call is one of `local(...)`, which evaluates its argument in a fresh environment */
function isLocalCall(node: RNode<ParentInformation>): boolean {
	return RFunctionCall.isNamed(node, 'local');
}

/** the package hooks R runs before it locks the namespace, so a `<<-` in them may still set a package variable */
const BeforeLocking: ReadonlySet<string> = new Set(['.onLoad']);

/** what a `<<-` in a package function writes: a binding of an enclosing scope, the package namespace, or the global environment */
function superAssignmentTarget(op: RNode<ParentInformation>, name: string, idMap: AstIdMap, topLevel: ReadonlySet<string>, memo: Map<NodeId, ReadonlySet<string>>): 'enclosing' | 'namespace' | 'global' | 'top-level' {
	let first = true;
	let outermost: RFunctionDefinition<ParentInformation> | undefined;
	for(let cur = op.info.parent === undefined ? undefined : idMap.get(op.info.parent); cur !== undefined; cur = cur.info.parent === undefined ? undefined : idMap.get(cur.info.parent)) {
		if(!RFunctionDefinition.is(cur) && !isLocalCall(cur)) {
			continue;
		}
		/* `<<-` starts its search in the parent of the frame it is evaluated in */
		if(first && RFunctionDefinition.is(cur)) {
			first = false;
			outermost = cur;
			continue;
		}
		first = false;
		outermost = RFunctionDefinition.is(cur) ? cur : outermost;
		if(localBindings(cur, memo).has(name)) {
			return 'enclosing';
		}
	}
	/* code outside of any function (`local({...})` included) runs as the package is installed, before anything is locked */
	if(outermost === undefined || BeforeLocking.has(boundName(outermost, idMap) ?? '')) {
		return 'top-level';
	}
	return topLevel.has(name) ? 'namespace' : 'global';
}

/** the names the top level of the package code binds */
function topLevelBindings(ast: NormalizedAst, isPackageCode: (file: string | undefined) => boolean): Set<string> {
	const names = new Set<string>();
	const idMap = ast.idMap;
	for(const node of projectNodes(ast)) {
		if(!RBinaryOp.is(node) || !LocalAssignments.has(node.operator) || !isPackageCode(node.info.file)) {
			continue;
		}
		const parent = node.info.parent === undefined ? undefined : idMap.get(node.info.parent);
		if(parent === undefined || (RExpressionList.is(parent) && parent.info.parent === undefined)) {
			const name = targetVariable(node.operator === '->' ? node.rhs : node.lhs);
			if(name !== undefined) {
				names.add(name);
			}
		}
	}
	return names;
}


/**
 * Port of the `R CMD check` notes on code that changes the global environment
 * (`checking R code for possible problems`): `tools:::.check_package_code_assign_to_globalenv`,
 * `.check_package_code_data_into_globalenv`, `.check_package_code_attach`, and the `codetools` note
 * "no visible binding for `<<-` assignment".
 */
export const GLOBAL_ENVIRONMENT_MODIFICATION = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const allowed = new Set(config.allowedGlobals);
		const results: GlobalEnvironmentModificationResult[] = [];
		let consideredCalls = 0;
		const add = (node: RNode<ParentInformation>, kind: GlobalEnvironmentModificationKind, message: string, variable?: string) => results.push({ ...at(node), kind, ...(variable !== undefined ? { variable } : {}), message });
		for(const { name, node, vertex: call } of packageCalls(df.graph, idMap, pkg, WriterNames, true)) {
			consideredCalls++;
			const args = FunctionSemantics.call.match.toSpec(call.args, EnvironmentWriters[name as keyof typeof EnvironmentWriters]);
			const arg = (formal: string) => {
				const ids = (args as ReadonlyMap<string, readonly NodeId[]>).get(formal);
				return ids?.length === 1 ? idMap.get(ids[0]) : undefined;
			};
			const env = call.environment ?? df.environment;
			const valueOf = (n: RNode<ParentInformation> | undefined) => RArgument.is(n) ? n.value : n;
			switch(name) {
				case 'attach':
					add(node, 'attach', 'attach() puts an object on the search path, where it masks and is masked by others; access it directly or use with() instead');
					break;
				case 'assign': {
					const target = valueOf(arg('x'));
					const variable = RString.is(target) ? target.content.str : undefined;
					if(variable !== undefined && allowed.has(variable)) {
						break;
					}
					if(denotesGlobalEnv(valueOf(arg('envir')), env, df, idMap, ctx) || denotesGlobalPos(valueOf(arg('pos'))) || denotesGlobalEnv(valueOf(arg('pos')), env, df, idMap, ctx)) {
						add(node, 'assign', `assign() writes ${variable === undefined ? 'a variable' : `'${variable}'`} into the global environment, which belongs to the user`, variable);
					}
					break;
				}
				case 'data': {
					const loads = (args.get('...')?.length ?? 0) > 0 || args.has('list');
					const envir = valueOf(arg('envir'));
					if(loads && (args.get('envir') === undefined || denotesGlobalEnv(envir, env, df, idMap, ctx))) {
						add(node, 'data', 'data() loads into the global environment, use data(..., envir = environment()) or lazy data instead');
					}
					break;
				}
			}
		}
		if(config.checkSuperAssignments) {
			const topLevel = topLevelBindings(ast, pkg.isPackageCode);
			const scopes = new Map<NodeId, ReadonlySet<string>>();
			for(const node of projectNodes(ast)) {
				if(!RBinaryOp.is(node) || (node.operator !== '<<-' && node.operator !== '->>') || !pkg.isPackageCode(node.info.file)) {
					continue;
				}
				const variable = targetVariable(node.operator === '->>' ? node.rhs : node.lhs);
				if(variable === undefined || allowed.has(variable)) {
					continue;
				}
				const target = superAssignmentTarget(node, variable, idMap, topLevel, scopes);
				if(target === 'global') {
					add(node, 'global-superassignment', `no visible binding for '<<-' assignment to '${variable}', which hence creates a variable in the global environment`, variable);
				} else if(target === 'namespace') {
					add(node, 'locked-superassignment', `'<<-' assignment to the package variable '${variable}', whose binding is locked once the package is loaded (use an environment to keep state instead)`, variable);
				}
			}
		}
		return { results, '.meta': { consideredCalls } };
	},
	prettyPrint: printer<GlobalEnvironmentModificationResult>(r => `${r.kind}${r.variable ? ` of ${r.variable}` : ''}`),
	info:        {
		name:          'Global Environment Modification',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds code that changes the global environment: `assign()` or `data()` into it, `attach()`, `<<-` without a binding in an enclosing function, and `<<-` to a package variable, whose binding is locked at run time.',
		defaultConfig: () => ({
			checkSuperAssignments: true,
			allowedGlobals:        ['.Random.seed']
		})
	}
} as const satisfies LintingRule<GlobalEnvironmentModificationResult, GlobalEnvironmentModificationMetadata, GlobalEnvironmentModificationConfig>;
