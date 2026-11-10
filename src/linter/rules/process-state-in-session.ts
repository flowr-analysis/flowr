import { prettyPrint, type LintingResult, type LintingRule, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { EmptyArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RPipe } from '../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { EdgeType } from '../../dataflow/graph/edge';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { Identifier, type BrandedIdentifier } from '../../dataflow/environments/identifier';
import { at, builtInOf } from '../linter-util';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { uniqueArray } from '../../util/collections/arrays';
import { accessedFieldName } from '../../dataflow/internal/linker';
import { calledDefinitions, formalNames, isWithin, projectNodes } from './cmd-check/cmd-check-util';
import { globalAssignment, superAssignmentTarget, targetVariable } from './cmd-check/global-environment-modification';

/** Ways per-session code changes process-wide state: `<<-` and `assign` to globals, `assignInNamespace`, setters like `options`, top-level reactive values, cache keys missing session values, and `addResourcePath` */
export enum ProcessStateChange {
	GlobalSuperAssignment = 'global-superassignment', GlobalAssign = 'global-assign', NamespacePatch = 'namespace-patch', ProcessSetting = 'process-setting',
	SharedState = 'shared-state', CacheKey = 'cache-key', ResourcePath = 'resource-path'
}

export interface ProcessStateInSessionResult extends LintingResult {
	readonly change:     ProcessStateChange
	/** the function or variable changing the state */
	readonly name:       BrandedIdentifier
	/** what to use instead */
	readonly suggestion: string
}

export interface ProcessStateInSessionConfig extends MergeableRecord {
	/** parameter lists marking a session function (Shiny server or module), all of one must be present */
	readonly sessionSignatures: readonly (readonly BrandedIdentifier[])[]
	/** process-wide setters, with what to use instead */
	readonly settings:          Readonly<Record<BrandedIdentifier, string>>
	/** functions creating state, shared when called at the top level */
	readonly sharedState:       readonly BrandedIdentifier[]
	/** cache constructors */
	readonly caches:            readonly BrandedIdentifier[]
	/** memoisers */
	readonly memoisers:         readonly BrandedIdentifier[]
}

export interface ProcessStateInSessionMetadata extends MergeableRecord {
	/** functions run per session */
	readonly sessionFunctions: number
}

type Node = RNode<ParentInformation>;

const SessionLocal = 'session$userData or a value created within the server function';
/** the functions reading what a setter changes */
const SettingReaders: Readonly<Record<BrandedIdentifier, readonly BrandedIdentifier[]>> = { 'options': ['getOption', 'options'], 'Sys.setenv': ['Sys.getenv'], 'Sys.unsetenv': ['Sys.getenv'], 'setwd': ['getwd'], 'Sys.setlocale': ['Sys.getlocale'] };
const MagrittrPipe = new Set(['%>%']);

const parentOf = RNode.directParent<ParentInformation>;
const argValue = RArgument.valueOf<ParentInformation>;
const argumentValue = (call: RFunctionCall<ParentInformation>, name: string) => argValue(RArgument.findNamed(call.arguments, name));
/** the value a plain assignment binds to the definition `def` */
const assigned = (def: NodeId, graph: DataflowGraph, idMap: AstIdMap): Node | undefined => idMap.get(Dataflow.assignedValueOf(def, graph) ?? '');
const references = (node: Node, graph: DataflowGraph): NodeId[] => [node.info.id, ...Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads)];
const extendsPath = (path: string, prefix: string) => path.startsWith(prefix) && (path.length === prefix.length || '$('.includes(path[prefix.length]));

/** whether the call is undone when its function exits, as in `op <- options(x = 1); on.exit(options(op))` */
function restoredOnExit(call: Node, name: BrandedIdentifier, idMap: AstIdMap): boolean {
	const fn = idMap.get(RNode.strictlyEnclosingFunction(call.info.id, idMap) ?? -1);
	let restored = false;
	RNode.visitAst(RFunctionDefinition.is(fn) ? fn.body : undefined, n => {
		if(RFunctionCall.isNamed(n, 'on.exit')) {
			RNode.visitAst(n, inner => {
				restored ||= RFunctionCall.isNamed(inner, name);
			});
		}
		return restored || RFunctionDefinition.is(n);
	});
	return restored;
}

/** variables bound at the top level to a call of `creators`, by id */
function topLevelOf(nodes: readonly Node[], idMap: AstIdMap, creators: readonly BrandedIdentifier[]): Map<NodeId, BrandedIdentifier> {
	return new Map(nodes.flatMap(n => RBinaryOp.is(n) && ['<-', '='].includes(n.operator) && RSymbol.is(n.lhs) && RFunctionCall.isNamed(n.rhs, new Set(creators))
		&& RNode.strictlyEnclosingFunction(n.info.id, idMap) === undefined ? [[n.lhs.info.id, Identifier.getName(n.lhs.content)] as const] : []));
}

const fieldName = (access: RAccess<ParentInformation>) => access.access.length === 1 ? accessedFieldName(argValue(access.access[0]), RAccess.isNamed(access)) : undefined;

/** the path a symbol is read by, e.g., `session$user$name` or `rv()` */
function readPath(symbol: RSymbol<ParentInformation>, idMap: AstIdMap): string {
	let path = String(Identifier.getName(symbol.content));
	for(let cur: Node = symbol, parent = parentOf(cur, idMap); parent !== undefined; cur = parent, parent = parentOf(cur, idMap)) {
		const field = RAccess.is(parent) && parent.accessed === cur ? fieldName(parent) : undefined;
		const read = RFunctionCall.isNamed(parent) && parent.functionName === cur && parent.arguments.length === 0;
		if(field === undefined && !read) {
			break;
		}
		path += field === undefined ? '()' : `$${field}`;
	}
	return path;
}

/** session values (parameters, reactive state, globals and settings a session writes) an expression reads, as paths; definitions are followed */
function sessionDependence(graph: DataflowGraph, idMap: AstIdMap, sessions: readonly NodeId[], stateCreators: ReadonlySet<BrandedIdentifier>, writtenGlobals: ReadonlySet<BrandedIdentifier>, changedSettings: ReadonlySet<BrandedIdentifier>) {
	const inSession = (id: NodeId) => sessions.some(s => isWithin(id, s, idMap));
	const isSessionValue = (def: NodeId): boolean => {
		const node = idMap.get(def);
		const param = RParameter.is(node) ? node : node && parentOf(node, idMap);
		return RParameter.is(param) ? sessions.includes(param.info.parent ?? -1) : inSession(def) && RFunctionCall.isNamed(assigned(def, graph, idMap), stateCreators);
	};
	/* reads without a resolved definition (reactives and function bodies run later) use the definitions in scope */
	const byName = Dataflow.definitionsByName(graph);
	const inScope = (symbol: RSymbol<ParentInformation>): NodeId[] => byName.get(Identifier.getName(symbol.content)).filter(d => {
		const scope = RNode.strictlyEnclosingFunction(d, idMap);
		return scope === undefined || isWithin(symbol.info.id, scope, idMap);
	});
	const expanded = new Map<NodeId, ReadonlySet<string>>();
	const ofDefinition = (def: NodeId): ReadonlySet<string> => {
		if(!expanded.has(def)) {
			expanded.set(def, new Set());
			expanded.set(def, of(assigned(def, graph, idMap)));
		}
		return expanded.get(def) ?? new Set();
	};
	const of = (root: Node | undefined): Set<string> => {
		const paths = new Set<string>();
		RNode.visitAst(root, n => {
			const parent = parentOf(n, idMap);
			if(!RSymbol.is(n) || DfgVertex.isVariableDefinition(graph.getVertex(n.info.id)) || (RArgument.is(parent) && RAccess.isNamed(parentOf(parent, idMap)))) {
				return;
			}
			const reader = RFunctionCall.isNamed(parent) && parent.functionName === n ? parent : n;
			const read = Dataflow.targetsOf(graph, reader.info.id, EdgeType.Reads);
			const defs = read.length > 0 ? read : inScope(n);
			const name = Identifier.getName(n.content);
			if(writtenGlobals.has(name) || (reader !== n && changedSettings.has(name)) || defs.some(isSessionValue)) {
				paths.add(readPath(n, idMap));
			} else {
				defs.forEach(d => ofDefinition(d).forEach(p => paths.add(p)));
			}
		});
		return paths;
	};
	return {
		inSession,
		/** session values `value` depends on that `key` misses */
		missing: (value: readonly (Node | undefined)[], key: readonly (Node | undefined)[]): string[] => {
			const keyPaths = key.flatMap(k => [...of(k)]);
			return uniqueArray(value.flatMap(v => [...of(v)])).filter(p => !keyPaths.some(k => extendsPath(p, k) || extendsPath(k, p)));
		}
	};
}

/** whether a cache argument names a shared cache, calls create fresh ones unless a function returns a shared one */
function sharedCache(arg: Node | undefined, graph: DataflowGraph, idMap: AstIdMap, inSession: (id: NodeId) => boolean, absent: boolean): boolean {
	if(arg === undefined || RString.is(arg)) {
		return arg === undefined ? absent : arg.content.str !== 'session';
	} else if(RFunctionCall.isNamed(arg)) {
		return calledDefinitions(graph, arg.info.id, idMap).some(fn => sharedCache(RExpressionList.is(fn.body) ? fn.body.children.at(-1) : fn.body, graph, idMap, inSession, false));
	}
	const defs = Dataflow.targetsOf(graph, arg.info.id, EdgeType.Reads);
	return RSymbol.is(arg) && (defs.length === 0 || defs.some(d => !inSession(d)));
}

/** the expression `bindCache` caches when it is piped into it */
function pipedInto(call: Node, idMap: AstIdMap): Node | undefined {
	const parent = parentOf(call, idMap);
	const outer = RArgument.is(parent) ? parentOf(parent, idMap) : undefined;
	return RPipe.is(parent) ? parent.rhs === call ? parent.lhs : undefined
		: RFunctionCall.isNamed(outer, MagrittrPipe) && argValue(outer.arguments[1]) === call ? argValue(outer.arguments[0]) : undefined;
}

/** a write to a shared cache: by `bindCache`, a function a memoiser wraps, or `$set` of a cache */
function cacheWrite(node: Node, graph: DataflowGraph, idMap: AstIdMap, inSession: (id: NodeId) => boolean, caches: ReadonlyMap<NodeId, BrandedIdentifier>, memoisers: ReadonlySet<BrandedIdentifier>) {
	if(RFunctionCall.isNamed(node, new Set(['bindCache']))) {
		const args = node.arguments.filter(a => a === EmptyArgument || a.name?.content !== 'cache').map(argValue);
		const piped = pipedInto(node, idMap);
		return sharedCache(argumentValue(node, 'cache'), graph, idMap, inSession, true) ? { name: 'bindCache', value: [piped ?? args[0]], key: piped === undefined ? args.slice(1) : args, fix: 'bindCache keys that include %s, or cache = "session"' } : undefined;
	} else if(RFunctionCall.isNamed(node)) {
		const direct = RFunctionCall.isNamed(node, new Set(['memoizedCall']));
		const memo = direct ? node : Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads).map(d => assigned(d, graph, idMap)).find(v => RFunctionCall.isNamed(v, memoisers));
		if(!RFunctionCall.is(memo) || (!direct && inSession(memo.info.id) && !sharedCache(argumentValue(memo, 'cache'), graph, idMap, inSession, false))) {
			return undefined;
		}
		const wrapped = argValue(memo.arguments[0]);
		const fn = RSymbol.is(wrapped) ? Dataflow.targetsOf(graph, wrapped.info.id, EdgeType.Reads).map(d => assigned(d, graph, idMap)).find(RFunctionDefinition.is) : wrapped;
		const args = direct ? memo.arguments.slice(1) : node.arguments;
		const omitted = new Set<BrandedIdentifier>();
		RNode.visitAst(argumentValue(memo, 'omit_args'), n => {
			if(RString.is(n)) {
				omitted.add(n.content.str);
			}
		});
		const left = [...FunctionSemantics.call.match.toNames(args, RFunctionDefinition.is(fn) ? formalNames(fn) : [])].filter(([p]) => omitted.has(p)).map(([, a]) => a);
		return {
			name:  Identifier.getName(node.functionName.content),
			value: [RFunctionDefinition.is(fn) ? fn.body : undefined, ...left.map(a => a.value)],
			key:   args.filter(a => a === EmptyArgument || !left.includes(a)).map(argValue),
			fix:   `arguments to ${Identifier.getName(node.functionName.content)} that include %s, or a cache per session`
		};
	}
	const called = RFunctionCall.is(node) ? node.calledFunction : undefined;
	const cache = RAccess.isNamed(called) && fieldName(called) === 'set' ? references(called.accessed, graph).map(d => caches.get(d)).find(n => n !== undefined) : undefined;
	return cache === undefined || !RFunctionCall.is(node) ? undefined : { name: cache, value: [argValue(node.arguments[1])], key: [argValue(node.arguments[0])], fix: 'a key that includes %s, or a cache per session' };
}

export const PROCESS_STATE_IN_SESSION = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const nodes = projectNodes(ast);
		const sessions = nodes.filter(n => RFunctionDefinition.is(n) && config.sessionSignatures.some(sig => sig.every(p => formalNames(n).includes(p)))).map(n => n.info.id);
		const inSession = (node: Node): boolean => sessions.some(s => isWithin(node.info.id, s, idMap));
		const shared = topLevelOf(nodes, idMap, config.sharedState);
		const scopes = new Map<NodeId, ReadonlySet<string>>();
		const results: ProcessStateInSessionResult[] = [];
		const add = (node: Node, change: ProcessStateChange, name: BrandedIdentifier, suggestion: string) => results.push({ ...at(node), change, name, suggestion });

		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			const node = idMap.get(id);
			const fn = Identifier.getName(builtInOf(df.graph, id) ?? '');
			if(fn === 'addResourcePath' && node !== undefined) {
				add(node, ProcessStateChange.ResourcePath, fn, 'serve the files from the www directory of the app, or check that every client may see the directory');
			}
			if(!RFunctionCall.is(node) || !inSession(node)) {
				continue;
			}
			const global = fn === 'assign' ? globalAssignment(vertex, df, idMap, data.inspectContext()) : undefined;
			if(config.settings[fn] !== undefined && node.arguments.length > 0 && !restoredOnExit(node, fn, idMap)) {
				add(node, ProcessStateChange.ProcessSetting, fn, config.settings[fn]);
			} else if(fn === 'assignInNamespace' || fn === 'assignInMyNamespace') {
				add(node, ProcessStateChange.NamespacePatch, fn, 'pass the changed behavior as an argument instead of patching the namespace');
			} else if(global !== undefined) {
				add(node, ProcessStateChange.GlobalAssign, global.variable ?? fn, SessionLocal);
			}
		}
		for(const node of nodes.filter(inSession)) {
			const symbol = RBinaryOp.is(node) && ['<-', '=', '<<-'].includes(node.operator) && RAccess.is(node.lhs) ? node.lhs.accessed : RFunctionCall.isNamed(node) && node.arguments.length > 0 ? node : undefined;
			const variable = symbol && references(symbol, df.graph).map(d => shared.get(d)).find(n => n !== undefined);
			const target = RBinaryOp.is(node) && (node.operator === '<<-' || node.operator === '->>') ? targetVariable(node.operator === '->>' ? node.rhs : node.lhs) : undefined;
			if(variable !== undefined) {
				add(node, ProcessStateChange.SharedState, variable, `create '${variable}' within the server function, or key it by the session`);
			} else if(target !== undefined && superAssignmentTarget(node, target, idMap, new Set(), scopes) === 'global') {
				add(node, ProcessStateChange.GlobalSuperAssignment, target, SessionLocal);
			}
		}
		const writtenGlobals = new Set(results.filter(r => r.change === ProcessStateChange.GlobalSuperAssignment || r.change === ProcessStateChange.GlobalAssign).map(r => r.name));
		const changedSettings = new Set(results.filter(r => r.change === ProcessStateChange.ProcessSetting).flatMap(r => SettingReaders[r.name] ?? []));
		const dependence = sessionDependence(df.graph, idMap, sessions, new Set(config.sharedState), writtenGlobals, changedSettings);
		const caches = topLevelOf(nodes, idMap, config.caches);
		for(const node of nodes.filter(inSession)) {
			const write = cacheWrite(node, df.graph, idMap, dependence.inSession, caches, new Set(config.memoisers));
			const missing = write === undefined ? [] : dependence.missing(write.value, write.key);
			if(write !== undefined && missing.length > 0) {
				add(node, ProcessStateChange.CacheKey, write.name, write.fix.replace('%s', missing.join(', ')));
			}
		}
		return { results: results.toSorted((a, b) => SourceLocation.compare(a.loc, b.loc)), '.meta': { sessionFunctions: sessions.length } };
	},
	prettyPrint: prettyPrint(
		result => `${result.change} by ${result.name} at ${SourceLocation.format(result.loc)}`,
		result => `${result.name} changes the state all sessions share (${result.change}) at ${SourceLocation.format(result.loc)}; instead, use ${result.suggestion}`
	),
	info: {
		name:          'Process State in Session',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Security, LintingRuleTag.Shiny],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds per-session Shiny code changing state all sessions share: globals, options, environment variables, the working directory, namespaces, top-level reactive values, shared caches (memoise, bindCache, cachem) whose key misses session values, and resource paths.',
		defaultConfig: () => ({
			sessionSignatures: [['input', 'output']],
			settings:          {
				'options':       'withr::with_options or withr::local_options',
				'Sys.setenv':    'withr::with_envvar or withr::local_envvar',
				'Sys.unsetenv':  'withr::with_envvar or withr::local_envvar',
				'setwd':         'absolute paths, or withr::with_dir',
				'Sys.setlocale': 'withr::with_locale',
				'set.seed':      'withr::with_seed',
				'Sys.umask':     'withr::with_umask'
			},
			sharedState: ['reactiveValues', 'reactiveVal'],
			caches:      ['cache_mem', 'cache_disk', 'cache_layered'],
			memoisers:   ['memoise', 'memoize', 'addMemoization']
		})
	}
} as const satisfies LintingRule<ProcessStateInSessionResult, ProcessStateInSessionMetadata, ProcessStateInSessionConfig>;
