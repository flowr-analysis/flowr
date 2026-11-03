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
import { VertexType } from '../../dataflow/graph/vertex';
import { EdgeType } from '../../dataflow/graph/edge';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { Identifier } from '../../dataflow/environments/identifier';
import { at, builtInOf } from '../linter-util';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { calledDefinitions, formalNames, isWithin, projectNodes } from './cmd-check/cmd-check-util';
import { globalAssignment, superAssignmentTarget, targetVariable } from './cmd-check/global-environment-modification';

/** Ways per-session code changes process-wide state */
export enum ProcessStateChange {
	/** `x <<- v` without a binding of `x` in an enclosing function */
	GlobalSuperAssignment = 'global-superassignment',
	/** `assign(..., envir = globalenv())` */
	GlobalAssign = 'global-assign',
	/** `assignInNamespace` and `assignInMyNamespace` */
	NamespacePatch = 'namespace-patch',
	/** `options`, `Sys.setenv`, `setwd`, and the like */
	ProcessSetting = 'process-setting',
	/** reactive values created at the top level and written per session */
	SharedState = 'shared-state',
	/** a shared cache whose key misses session values the result depends on */
	CacheKey = 'cache-key',
	/** `addResourcePath`, serving a directory to all clients */
	ResourcePath = 'resource-path'
}

export interface ProcessStateInSessionResult extends LintingResult {
	readonly change:     ProcessStateChange
	/** the function or variable changing the state */
	readonly name:       string
	/** what to use instead */
	readonly suggestion: string
}

export interface ProcessStateInSessionConfig extends MergeableRecord {
	/** parameter lists marking a session function (Shiny server or module), all of one must be present */
	readonly sessionSignatures: readonly (readonly string[])[]
	/** process-wide setters, with what to use instead */
	readonly settings:          Readonly<Record<string, string>>
	/** functions creating state, shared when called at the top level */
	readonly sharedState:       readonly string[]
	/** cache constructors */
	readonly caches:            readonly string[]
	/** memoisers */
	readonly memoisers:         readonly string[]
}

export interface ProcessStateInSessionMetadata extends MergeableRecord {
	/** functions run per session */
	readonly sessionFunctions: number
}

const SessionLocal = 'session$userData or a value created within the server function';

const parentOf = (node: RNode<ParentInformation>, idMap: AstIdMap) => node.info.parent === undefined ? undefined : idMap.get(node.info.parent);

/** whether the call is undone when its function exits, as in `op <- options(x = 1); on.exit(options(op))` */
function restoredOnExit(call: RFunctionCall<ParentInformation>, name: string, idMap: AstIdMap): boolean {
	const fn = idMap.get(RNode.strictlyEnclosingFunction(call.info.id, idMap) ?? -1);
	let restored = false;
	if(RFunctionDefinition.is(fn)) {
		RNode.visitAst(fn.body, n => {
			if(RFunctionDefinition.is(n)) {
				return true;
			}
			if(RFunctionCall.isNamed(n, 'on.exit')) {
				RNode.visitAst(n, inner => {
					restored ||= RFunctionCall.isNamed(inner, name);
				});
			}
			return restored;
		});
	}
	return restored;
}

/** top-level shared state, by variable id */
function sharedStateDefinitions(nodes: readonly RNode<ParentInformation>[], idMap: AstIdMap, creators: ReadonlySet<string>): Map<NodeId, string> {
	const defs = new Map<NodeId, string>();
	for(const node of nodes) {
		const parent = parentOf(node, idMap);
		if(!RBinaryOp.is(node) || !['<-', '='].includes(node.operator) || !RSymbol.is(node.lhs) || !(parent === undefined || (RExpressionList.is(parent) && parent.info.parent === undefined))) {
			continue;
		}
		if(RFunctionCall.isNamed(node.rhs, creators)) {
			defs.set(node.lhs.info.id, Identifier.getName(node.lhs.content));
		}
	}
	return defs;
}

const references = (node: RNode<ParentInformation>, graph: DataflowGraph): NodeId[] => [node.info.id, ...Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads)];

/** the shared variable a write in a session targets: `rv$x <- v` or `counter(v)` */
function writtenSharedState(node: RNode<ParentInformation>, graph: DataflowGraph, shared: ReadonlyMap<NodeId, string>): string | undefined {
	const symbol = RBinaryOp.is(node) && ['<-', '=', '<<-'].includes(node.operator) && RAccess.is(node.lhs) ? node.lhs.accessed
		: RFunctionCall.isNamed(node) && node.arguments.length > 0 ? node : undefined;
	return symbol === undefined ? undefined : references(symbol, graph).map(d => shared.get(d)).find(n => n !== undefined);
}

/** the value an assignment gives the variable `node` */
function definedValue(node: RNode<ParentInformation> | undefined, idMap: AstIdMap): RNode<ParentInformation> | undefined {
	const parent = node === undefined ? undefined : parentOf(node, idMap);
	if(!RBinaryOp.is(parent)) {
		return undefined;
	}
	const right = ['->', '->>'].includes(parent.operator);
	return (right || ['<-', '=', '<<-'].includes(parent.operator)) && (right ? parent.rhs : parent.lhs) === node ? (right ? parent.lhs : parent.rhs) : undefined;
}

const argValue = (arg: RArgument<ParentInformation> | typeof EmptyArgument | undefined) => arg === EmptyArgument ? undefined : arg?.value;

function argumentValue(call: RFunctionCall<ParentInformation>, name: string): RNode<ParentInformation> | undefined {
	return argValue(call.arguments.find(a => RArgument.isNamed(a) && a.name.content === name));
}

function fieldName(access: RAccess<ParentInformation>): string | undefined {
	const value = access.access.length === 1 ? argValue(access.access[0]) : undefined;
	if(RString.is(value)) {
		return value.content.str;
	}
	return RAccess.isNamed(access) && RSymbol.is(value) ? Identifier.getName(value.content) : undefined;
}

/** the path a symbol is read by, e.g., `session$user$name` or `rv()` */
function readPath(symbol: RSymbol<ParentInformation>, idMap: AstIdMap): string {
	let path = Identifier.getName(symbol.content);
	for(let cur: RNode<ParentInformation> = symbol, parent = parentOf(cur, idMap); parent !== undefined; cur = parent, parent = parentOf(cur, idMap)) {
		const field = RAccess.is(parent) && parent.accessed.info.id === cur.info.id ? fieldName(parent) : undefined;
		if(field !== undefined) {
			path += `$${field}`;
		} else if(RFunctionCall.isNamed(parent) && parent.functionName.info.id === cur.info.id && parent.arguments.length === 0) {
			path += '()';
		} else {
			break;
		}
	}
	return path;
}

const extendsPath = (path: string, prefix: string) => path.startsWith(prefix) && (path.length === prefix.length || '$('.includes(path[prefix.length]));

/** session values (parameters, reactive state, globals and settings a session writes) an expression reads, as paths; definitions are followed */
function sessionDependence(graph: DataflowGraph, idMap: AstIdMap, sessions: readonly NodeId[], stateCreators: ReadonlySet<string>, writtenGlobals: ReadonlySet<string>, changedSettings: ReadonlySet<string>) {
	const inSession = (id: NodeId) => sessions.some(s => isWithin(id, s, idMap));
	const isSessionValue = (def: NodeId): boolean => {
		const node = idMap.get(def);
		const param = RParameter.is(node) ? node : node && parentOf(node, idMap);
		if(RParameter.is(param)) {
			return param.info.parent !== undefined && sessions.includes(param.info.parent);
		}
		return inSession(def) && RFunctionCall.isNamed(definedValue(node, idMap), stateCreators);
	};
	let byName: Map<string, NodeId[]> | undefined;
	/** the definitions in scope of a read without a resolved one, as reactives and function bodies run later */
	const inScope = (symbol: RSymbol<ParentInformation>): NodeId[] => {
		if(byName === undefined) {
			byName = new Map();
			for(const node of idMap.values()) {
				if(RSymbol.is(node) && definedValue(node, idMap) !== undefined) {
					const name = Identifier.getName(node.content);
					byName.set(name, [...byName.get(name) ?? [], node.info.id]);
				}
			}
		}
		return (byName.get(Identifier.getName(symbol.content)) ?? []).filter(d => {
			const scope = RNode.strictlyEnclosingFunction(d, idMap);
			return scope === undefined || isWithin(symbol.info.id, scope, idMap);
		});
	};
	const expanded = new Map<NodeId, ReadonlySet<string>>();
	const ofDefinition = (def: NodeId): ReadonlySet<string> => {
		if(!expanded.has(def)) {
			expanded.set(def, new Set());
			const value = definedValue(idMap.get(def), idMap);
			expanded.set(def, value === undefined ? new Set() : of(value));
		}
		return expanded.get(def) ?? new Set();
	};
	const of = (root: RNode<ParentInformation>): Set<string> => {
		const paths = new Set<string>();
		RNode.visitAst(root, n => {
			const parent = parentOf(n, idMap);
			if(!RSymbol.is(n) || definedValue(n, idMap) !== undefined || (RArgument.is(parent) && RAccess.isNamed(parentOf(parent, idMap)))) {
				return;
			}
			const reader = RFunctionCall.isNamed(parent) && parent.functionName.info.id === n.info.id ? parent : n;
			const read = Dataflow.targetsOf(graph, reader.info.id, EdgeType.Reads);
			const defs = read.length > 0 ? read : inScope(n);
			const name = Identifier.getName(n.content);
			if(writtenGlobals.has(name) || (reader !== n && changedSettings.has(name)) || defs.some(isSessionValue)) {
				paths.add(readPath(n, idMap));
			} else {
				for(const def of defs) {
					ofDefinition(def).forEach(p => paths.add(p));
				}
			}
		});
		return paths;
	};
	return {
		inSession,
		/** session values `value` depends on that `key` misses */
		missing: (value: readonly (RNode<ParentInformation> | undefined)[], key: readonly (RNode<ParentInformation> | undefined)[]): string[] => {
			const keyPaths = key.flatMap(k => k === undefined ? [] : [...of(k)]);
			const paths = new Set(value.flatMap(v => v === undefined ? [] : [...of(v)]));
			return [...paths].filter(p => !keyPaths.some(k => extendsPath(p, k) || extendsPath(k, p)));
		}
	};
}

/** a write to a shared cache, with value and key */
interface CacheWrite {
	readonly name:  string
	readonly value: readonly (RNode<ParentInformation> | undefined)[]
	readonly key:   readonly (RNode<ParentInformation> | undefined)[]
	readonly fix:   (missing: string) => string
}

/** the functions reading what a setter changes */
const SettingReaders: Readonly<Record<string, readonly string[]>> = {
	'options':       ['getOption', 'options'],
	'Sys.setenv':    ['Sys.getenv'],
	'Sys.unsetenv':  ['Sys.getenv'],
	'setwd':         ['getwd'],
	'Sys.setlocale': ['Sys.getlocale']
};

const BindCache = new Set(['bindCache']);
const MemoizedCall = new Set(['memoizedCall']);
const MagrittrPipe = new Set(['%>%']);

/** whether a cache argument names a shared cache, calls create fresh ones */
function sharedCache(arg: RNode<ParentInformation> | undefined, graph: DataflowGraph, idMap: AstIdMap, inSession: (id: NodeId) => boolean, absent: boolean): boolean {
	if(arg === undefined) {
		return absent;
	} else if(RString.is(arg)) {
		return arg.content.str !== 'session';
	} else if(RFunctionCall.isNamed(arg)) {
		return calledDefinitions(graph, arg.info.id, idMap).some(fn => sharedCache(lastExpression(fn.body), graph, idMap, inSession, false));
	}
	const defs = RSymbol.is(arg) ? Dataflow.targetsOf(graph, arg.info.id, EdgeType.Reads) : [];
	return RSymbol.is(arg) && (defs.length === 0 || defs.some(d => !inSession(d)));
}

const lastExpression = (node: RNode<ParentInformation>): RNode<ParentInformation> | undefined => RExpressionList.is(node) ? node.children.at(-1) : node;

/** the function a symbol refers to */
function resolveFunction(node: RNode<ParentInformation> | undefined, graph: DataflowGraph, idMap: AstIdMap): RFunctionDefinition<ParentInformation> | undefined {
	return RSymbol.is(node) ? Dataflow.targetsOf(graph, node.info.id, EdgeType.Reads).map(d => definedValue(idMap.get(d), idMap)).find(RFunctionDefinition.is)
		: RFunctionDefinition.is(node) ? node : undefined;
}

/** the expression `bindCache` caches when it is piped into it */
function pipedInto(call: RFunctionCall<ParentInformation>, idMap: AstIdMap): RNode<ParentInformation> | undefined {
	const parent = parentOf(call, idMap);
	if(RPipe.is(parent)) {
		return parent.rhs.info.id === call.info.id ? parent.lhs : undefined;
	}
	const outer = RArgument.is(parent) ? parentOf(parent, idMap) : undefined;
	return RFunctionCall.isNamed(outer, MagrittrPipe) && argValue(outer.arguments[1])?.info.id === call.info.id ? argValue(outer.arguments[0]) : undefined;
}

/** a call of a memoized function, via `memoizedCall` or a memoiser */
function memoizedCall(call: RFunctionCall<ParentInformation>, graph: DataflowGraph, idMap: AstIdMap, inSession: (id: NodeId) => boolean, memoisers: ReadonlySet<string>): CacheWrite | undefined {
	const direct = RFunctionCall.isNamed(call, MemoizedCall);
	const memo = direct ? call : Dataflow.targetsOf(graph, call.info.id, EdgeType.Reads).map(d => definedValue(idMap.get(d), idMap)).find(v => RFunctionCall.isNamed(v, memoisers));
	if(!RFunctionCall.is(memo) || !RFunctionCall.isNamed(call) || (!direct && inSession(memo.info.id) && !sharedCache(argumentValue(memo, 'cache'), graph, idMap, inSession, false))) {
		return undefined;
	}
	const [wrapped, ...rest] = memo.arguments;
	const fn = resolveFunction(argValue(wrapped), graph, idMap);
	const args = direct ? rest : call.arguments;
	const omitted = new Set<string>();
	RNode.visitAst(argumentValue(memo, 'omit_args'), n => {
		if(RString.is(n)) {
			omitted.add(n.content.str);
		}
	});
	const omittedArgs = [...FunctionSemantics.call.match.toNames(args, fn === undefined ? [] : formalNames(fn))].filter(([p]) => omitted.has(p)).map(([, a]) => a);
	const name = Identifier.getName(call.functionName.content);
	return {
		name,
		value: [fn?.body, ...omittedArgs.map(a => a.value)],
		key:   args.filter(a => a === EmptyArgument || !omittedArgs.includes(a)).map(argValue),
		fix:   missing => `arguments to ${name} that include ${missing}, or a cache per session`
	};
}

/** a write to a shared cache by `bindCache`, a memoized function, or `$set` */
function cacheWrite(node: RNode<ParentInformation>, graph: DataflowGraph, idMap: AstIdMap, inSession: (id: NodeId) => boolean, caches: ReadonlyMap<NodeId, string>, memoisers: ReadonlySet<string>): CacheWrite | undefined {
	if(!RFunctionCall.is(node)) {
		return undefined;
	} else if(RFunctionCall.isNamed(node, BindCache)) {
		const args = node.arguments.filter(a => a === EmptyArgument || a.name?.content !== 'cache').map(argValue);
		const piped = pipedInto(node, idMap);
		return sharedCache(argumentValue(node, 'cache'), graph, idMap, inSession, true) ? {
			name:  'bindCache',
			value: [piped ?? args[0]],
			key:   piped === undefined ? args.slice(1) : args,
			fix:   missing => `bindCache keys that include ${missing}, or cache = "session"`
		} : undefined;
	} else if(RFunctionCall.isNamed(node)) {
		return memoizedCall(node, graph, idMap, inSession, memoisers);
	}
	const called = node.calledFunction;
	const cache = RAccess.isNamed(called) && fieldName(called) === 'set' ? references(called.accessed, graph).map(d => caches.get(d)).find(n => n !== undefined) : undefined;
	const [key, value] = node.arguments.map(argValue);
	return cache === undefined ? undefined : { name: cache, value: [value], key: [key], fix: missing => `a key that includes ${missing}, or a cache per session` };
}

export const PROCESS_STATE_IN_SESSION = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const ctx = data.inspectContext();
		const nodes = projectNodes(ast);
		const isSession = (params: readonly string[]) => config.sessionSignatures.some(sig => sig.every(p => params.includes(p)));
		const sessions = nodes.filter(n => RFunctionDefinition.is(n) && isSession(formalNames(n))).map(n => n.info.id);
		const inSession = (node: RNode<ParentInformation>): boolean => sessions.some(s => isWithin(node.info.id, s, idMap));
		const shared = sharedStateDefinitions(nodes, idMap, new Set(config.sharedState));
		const scopes = new Map<NodeId, ReadonlySet<string>>();
		const results: ProcessStateInSessionResult[] = [];
		const add = (node: RNode<ParentInformation>, change: ProcessStateChange, name: string, suggestion: string) => results.push({ ...at(node), change, name, suggestion });

		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			const node = idMap.get(id);
			const name = builtInOf(df.graph, id);
			if(node === undefined || name === undefined) {
				continue;
			}
			const fn = Identifier.getName(name);
			if(fn === 'addResourcePath') {
				add(node, ProcessStateChange.ResourcePath, fn, 'serve the files from the www directory of the app, or check that every client may see the directory');
			}
			if(!inSession(node) || !RFunctionCall.is(node)) {
				continue;
			}
			const setting = config.settings[fn];
			if(setting !== undefined && node.arguments.length > 0 && !restoredOnExit(node, fn, idMap)) {
				add(node, ProcessStateChange.ProcessSetting, fn, setting);
			} else if(fn === 'assignInNamespace' || fn === 'assignInMyNamespace') {
				add(node, ProcessStateChange.NamespacePatch, fn, 'pass the changed behavior as an argument instead of patching the namespace');
			} else if(fn === 'assign') {
				const global = globalAssignment(vertex, df, idMap, ctx);
				if(global !== undefined) {
					add(node, ProcessStateChange.GlobalAssign, global.variable ?? fn, SessionLocal);
				}
			}
		}
		for(const node of nodes) {
			if(!inSession(node)) {
				continue;
			}
			const variable = writtenSharedState(node, df.graph, shared);
			if(variable !== undefined) {
				add(node, ProcessStateChange.SharedState, variable, `create '${variable}' within the server function, or key it by the session`);
			} else if(RBinaryOp.is(node) && (node.operator === '<<-' || node.operator === '->>')) {
				const target = targetVariable(node.operator === '->>' ? node.rhs : node.lhs);
				if(target !== undefined && superAssignmentTarget(node, target, idMap, new Set(), scopes) === 'global') {
					add(node, ProcessStateChange.GlobalSuperAssignment, target, SessionLocal);
				}
			}
		}
		const writtenGlobals = new Set(results.filter(r => r.change === ProcessStateChange.GlobalSuperAssignment || r.change === ProcessStateChange.GlobalAssign).map(r => r.name));
		const changedSettings = new Set(results.filter(r => r.change === ProcessStateChange.ProcessSetting).flatMap(r => SettingReaders[r.name] ?? []));
		const dependence = sessionDependence(df.graph, idMap, sessions, new Set(config.sharedState), writtenGlobals, changedSettings);
		const caches = sharedStateDefinitions(nodes, idMap, new Set(config.caches));
		const memoisers = new Set(config.memoisers);
		for(const node of nodes) {
			const write = inSession(node) ? cacheWrite(node, df.graph, idMap, dependence.inSession, caches, memoisers) : undefined;
			const missing = write === undefined ? [] : dependence.missing(write.value, write.key);
			if(write !== undefined && missing.length > 0) {
				add(node, ProcessStateChange.CacheKey, write.name, write.fix(missing.join(', ')));
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
