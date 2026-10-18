import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { fnInfo } from '../../../dataflow/environments/query-fn-props';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { boundName, calledDefinitions, isQuoted, type CmdCheckResult, formalNames, packageInfo, projectNodes } from './cmd-check-util';

export type CallArgumentsKind =
	/** a named argument no formal of the called function takes */
	| 'unused-named'
	/** more positional arguments than the called function takes */
	| 'unused-positional'
	/** a named argument that only matches a formal by a prefix of its name */
	| 'partial-match'
	/** a named argument whose name is a prefix of several formals */
	| 'ambiguous-match'
	/** `...` (or `..1`) used in a function that takes no `...` */
	| 'dots-out-of-context'
	/** a local function bound to one name twice, with different formals */
	| 'conflicting-definitions';

export interface CallArgumentsResult extends CmdCheckResult {
	readonly kind:      CallArgumentsKind
	/** the function called or defined */
	readonly function?: string
	/** the argument concerned, if any */
	readonly argument?: string
}

export interface CallArgumentsConfig extends MergeableRecord {
	/** report arguments that only match a formal by a prefix of its name (default `true`, as `R CMD check` does) */
	readonly reportPartialMatches:  boolean
	/** also check calls of functions from other packages, whose formals the signature database states (default `true`) */
	readonly checkPackageFunctions: boolean
}

export interface CallArgumentsMetadata extends MergeableRecord {
	/** calls whose target(s) flowR knows the formals of */
	readonly checkedCalls: number
}

const Dots = '...';

/** the formals of a package function, if the signature database knows them: flowR's own built-ins merely state the ones they model */
function packageFormals(name: Identifier, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const info = fnInfo(name, ctx);
	return info?.entry === undefined || info.entry.signature.length === 0 ? undefined : [...info.parameters];
}

interface Targets {
	readonly formals: readonly (readonly string[])[]
	/** whether the formals are those of the function the call binds to, rather than of a source that may be off */
	readonly certain: boolean
}

/**
 * The formals of what a call may reach: the definitions of the code, or a package function the signature database
 * knows (whose formals may belong to another version, so they are uncertain). A definition the call reaches
 * through a function factory may have its formals rewritten (`formals(f) <- ...`), so it is not trusted when the
 * code rewrites formals anywhere.
 */
function targetsOf(id: NodeId, name: Identifier, df: DataflowInformation, idMap: AstIdMap, ctx: ReadOnlyFlowrAnalyzerContext, packages: boolean, rewritesFormals: boolean): Targets | undefined {
	/* a built-in also calls the functions it is handed (`lapply(x, f)`), so only the origins tell what is called */
	const origins = Dataflow.origin(df.graph, id) ?? [];
	if(!origins.some(o => o.type === OriginType.BuiltInFunctionOrigin)) {
		const defs = calledDefinitions(df.graph, id, idMap);
		if(defs.length > 0) {
			const direct = defs.every(d => boundName(d, idMap) === Identifier.getName(name));
			return !direct && rewritesFormals ? undefined : { formals: defs.map(formalNames), certain: direct };
		}
	}
	/* a call reaching nothing of the code binds to what the packages offer, unless it may reach an unknown function */
	if(!packages || origins.some(o => o.type !== OriginType.BuiltInFunctionOrigin)) {
		return undefined;
	}
	const known = packageFormals(origins.length === 1 && origins[0].type === OriginType.BuiltInFunctionOrigin ? origins[0].fn.name : name, ctx);
	return known === undefined ? undefined : { formals: [known], certain: false };
}

/** the replacement functions that rewrite a function, after which its formals are no longer those of its definition */
const FormalsRewriters: ReadonlySet<string> = new Set(['formals<-', 'body<-', 'args<-']);

interface Mismatch {
	readonly kind:      CallArgumentsKind
	readonly argument?: string
	readonly message:   string
}

/** how R would match the arguments of `call` to `formals`, the problems it would run into */
function mismatchesOf(call: RFunctionCall<ParentInformation>, formals: readonly string[], partial: boolean): Mismatch[] {
	const dots = formals.indexOf(Dots);
	/* only the formals before `...` match by a prefix of their name */
	const prefixable = dots < 0 ? formals : formals.slice(0, dots);
	const result: Mismatch[] = [];
	const bound = new Set<string>();
	let positional = 0;
	let spreads = false;
	for(const arg of call.arguments) {
		if(arg === EmptyArgument) {
			positional++;
			continue;
		}
		const name = arg.name === undefined ? undefined : Identifier.getName(arg.name.content);
		if(name === undefined) {
			if(RSymbol.is(arg.value) && Identifier.getName(arg.value.content) === Dots) {
				spreads = true;
			} else {
				positional++;
			}
			continue;
		}
		if(formals.includes(name)) {
			bound.add(name);
			continue;
		}
		const candidates = prefixable.filter(f => f.startsWith(name) && !bound.has(f));
		if(candidates.length === 1) {
			bound.add(candidates[0]);
			if(partial) {
				result.push({ kind: 'partial-match', argument: name, message: `partial argument match of '${name}' to '${candidates[0]}'` });
			}
		} else if(candidates.length > 1) {
			result.push({ kind: 'ambiguous-match', argument: name, message: `argument '${name}' matches multiple formal arguments (${candidates.join(', ')})` });
		} else if(dots < 0) {
			result.push({ kind: 'unused-named', argument: name, message: `unused argument (${name} = ...)` });
		}
	}
	if(dots < 0 && !spreads) {
		const free = formals.filter(f => !bound.has(f)).length;
		if(positional > free) {
			result.push({ kind: 'unused-positional', message: `unused argument${positional - free > 1 ? 's' : ''}: ${positional} positional arguments for ${free} remaining formal${free === 1 ? '' : 's'}` });
		}
	}
	return result;
}

/** the given function definition and all definitions enclosing it */
function enclosingFunctions(fn: RFunctionDefinition<ParentInformation>, idMap: ReadonlyMap<NodeId, RNode<ParentInformation>>): RFunctionDefinition<ParentInformation>[] {
	const result = [fn];
	for(let cur = idMap.get(fn.info.parent ?? ''); cur !== undefined; cur = idMap.get(cur.info.parent ?? '')) {
		if(RFunctionDefinition.is(cur)) {
			result.push(cur);
		}
	}
	return result;
}

/**
 * Port of the `codetools` checks `R CMD check` runs in `checking R code for possible problems`: "possible error in
 * f(...): unused argument", "partial argument match of 'a' to 'abc'", "... may be used in an incorrect context", and
 * "multiple local function definitions for 'f' with different formal arguments".
 */
export const CALL_ARGUMENTS = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const results: CallArgumentsResult[] = [];
		let checkedCalls = 0;
		const add = (node: RNode<ParentInformation>, r: Omit<CallArgumentsResult, 'loc' | 'involvedId' | 'certainty'>, certain = true) => {
			const loc = SourceLocation.fromNode(node);
			if(loc !== undefined) {
				results.push({ certainty: certain ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain, involvedId: node.info.id, loc, ...r });
			}
		};

		const calls = [...df.graph.verticesOfType(VertexType.FunctionCall)];
		const rewritesFormals = calls.some(([, v]) => FormalsRewriters.has(Identifier.getName(v.name)));
		for(const [id, vertex] of calls) {
			const node = idMap.get(id);
			/* quoted code is data, as codetools sees it too */
			if(!RFunctionCall.isNamed(node) || !pkg.isPackageCode(node.info.file) || isQuoted(df.graph, id, idMap)) {
				continue;
			}
			const targets = targetsOf(id, vertex.name, df, idMap, ctx, config.checkPackageFunctions, rewritesFormals);
			if(targets === undefined) {
				continue;
			}
			checkedCalls++;
			const perTarget = targets.formals.map(f => mismatchesOf(node, f, config.reportPartialMatches));
			const fn = Identifier.toString(vertex.name);
			/* a mismatch with every possible target is certain, with only some of them it is not */
			const keys = new Map<string, { m: Mismatch, count: number }>();
			for(const mismatches of perTarget) {
				for(const m of mismatches) {
					const key = `${m.kind}:${m.argument ?? ''}`;
					const entry = keys.get(key);
					keys.set(key, { m, count: (entry?.count ?? 0) + 1 });
				}
			}
			for(const { m, count } of keys.values()) {
				add(node, { kind: m.kind, function: fn, ...(m.argument !== undefined ? { argument: m.argument } : {}), message: `possible error in ${fn}(): ${m.message}` }, targets.certain && count === targets.formals.length);
			}
		}

		const nodes = projectNodes(ast);
		for(const node of nodes) {
			if(!pkg.isPackageCode(node.info.file)) {
				continue;
			}
			const parent = idMap.get(node.info.parent ?? '');
			/* the formal `...` and an argument named `...` (`switch(x, ... = 1)`, `alist(... = )`) use no dots */
			if(!RSymbol.is(node) || RParameter.is(parent) || (RArgument.is(parent) && parent.name === node) || isQuoted(df.graph, node.info.id, idMap)) {
				continue;
			}
			const name = Identifier.getName(node.content);
			if(name !== Dots && !/^\.\.[0-9]+$/.test(name)) {
				continue;
			}
			/* `...` is looked up like any variable, so the closure of a function taking it may use it as well */
			const fn = idMap.get(RNode.findEnclosing(node.info.id, idMap, RFunctionDefinition.is) ?? '');
			if(RFunctionDefinition.is(fn) && !enclosingFunctions(fn, idMap).some(f => formalNames(f).includes(Dots))) {
				const bound = boundName(fn, idMap);
				add(node, { kind: 'dots-out-of-context', ...(bound !== undefined ? { function: bound } : {}), message: `${name} may be used in an incorrect context, ${bound ?? 'the function'} takes no '...'` });
			}
		}

		/* functions bound to the same name twice within one function body, with other formals */
		const scopes = new Map<NodeId | undefined, Map<string, RFunctionDefinition<ParentInformation>[]>>();
		for(const node of nodes) {
			if(!RFunctionDefinition.is(node) || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			const name = boundName(node, idMap);
			const scope = RNode.strictlyEnclosingFunction(node.info.id, idMap);
			if(name === undefined || scope === undefined) {
				continue;
			}
			const perName = scopes.get(scope) ?? new Map<string, RFunctionDefinition<ParentInformation>[]>();
			scopes.set(scope, perName);
			perName.set(name, [...perName.get(name) ?? [], node]);
		}
		for(const perName of scopes.values()) {
			for(const [name, defs] of perName) {
				const signatures = new Set(defs.map(d => formalNames(d).join(',')));
				if(signatures.size > 1) {
					add(defs[defs.length - 1], { kind: 'conflicting-definitions', function: name, message: `multiple local function definitions for '${name}' with different formal arguments` });
				}
			}
		}
		return { results, '.meta': { checkedCalls } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.kind}${result.function ? ` in ${result.function}` : ''}${result.argument ? ` (${result.argument})` : ''} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Call Arguments',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds calls with arguments the called function does not take, names that match a formal only partially or match several formals, `...` used in a function without `...`, and local functions defined twice with different formals. Calls are resolved through the dataflow graph.',
		defaultConfig: () => ({
			reportPartialMatches:  true,
			checkPackageFunctions: true
		})
	}
} as const satisfies LintingRule<CallArgumentsResult, CallArgumentsMetadata, CallArgumentsConfig>;
