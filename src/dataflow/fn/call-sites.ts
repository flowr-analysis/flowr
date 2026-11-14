import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../graph/graph';
import { type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, DfgVertex } from '../graph/vertex';
import { EdgeType } from '../graph/edge';
import { Dataflow } from '../graph/df-helper';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { type BrandedIdentifier, Identifier } from '../environments/identifier';
import { DotsParameterName, matchArgumentsToParameters } from '../../util/arg-matching';

/** One call of a function the program defines: the call and the definition it runs. */
export interface CallSite<Info = ParentInformation> {
	readonly call:       RFunctionCall<Info & ParentInformation>
	readonly definition: RFunctionDefinition<Info & ParentInformation>
}

/** At most this many argument lists a call stands for across the calls reaching it, more leave the arguments as they are written. */
const MaxContexts = 16;
/** At most this many calls deep the arguments are followed, so a recursive function stops. */
const MaxDepth = 8;

type Args<Info> = readonly PotentiallyEmptyRArgument<Info & ParentInformation>[];

function formalNames<Info>(definition: RFunctionDefinition<Info>): (BrandedIdentifier | undefined)[] {
	return definition.parameters.map(p => p?.special ? DotsParameterName : p?.name?.content);
}

function argumentName<Info>(arg: PotentiallyEmptyRArgument<Info>): BrandedIdentifier | undefined {
	return arg === EmptyArgument || arg.name === undefined ? undefined : Identifier.getName(arg.name.content);
}

/** The definition and position of the parameter named by the symbol `id`, from a parameter node or a symbol reading only that parameter. */
function parameterAt<Info>(id: NodeId, graph: DataflowGraph): [definition: RFunctionDefinition<Info & ParentInformation>, at: number] | undefined {
	const idMap = graph.idMap as AstIdMap<Info> | undefined;
	const reads = Dataflow.targetsOf(graph, id, EdgeType.Reads);
	const name = reads.length === 1 ? reads[0] : id;
	const parameter = idMap?.get(idMap.get(name)?.info.parent ?? -1);
	const definition = RParameter.is(parameter) && parameter.name.info.id === name ? idMap?.get(parameter.info.parent ?? -1) : undefined;
	return RFunctionDefinition.is(definition) ? [definition, definition.parameters.indexOf(parameter as RParameter<Info & ParentInformation>)] : undefined;
}

function isSameParameter<Info>(found: [RFunctionDefinition<Info>, number] | undefined, definition: RFunctionDefinition<Info>, index: number): boolean {
	return found !== undefined && found[0] === definition && found[1] === index;
}

/**
 * The calls and the closures of a program between each other: who calls a function, what a call binds to its formals,
 * and the arguments a call stands for once the parameters it hands on (`f <- function(...) g(...)`) are replaced by what the calls of `f` give.
 * Everything interprocedural asks these instead of looking at one function alone.
 * @helper dataflow
 */
export const CallSites = {
	name:    'CallSites',
	/** The formal names of the definition as R's argument matching takes them, `...` for the dots. */
	formals: formalNames,
	/** The definition whose parameter the node `id` is, or reads alone (`x` in `function(x) x`), with the position of the parameter. */
	parameterAt,
	/** The definition the node `id` sits in, if any. */
	enclosing<Info>(this: void, id: NodeId, idMap: AstIdMap<Info>): RFunctionDefinition<Info & ParentInformation> | undefined {
		const definition = idMap.get(RNode.strictlyEnclosingFunction(id, idMap) ?? -1);
		return RFunctionDefinition.is(definition) ? definition : undefined;
	},
	/** The definitions the call `call` runs, see {@link Dataflow.calleeDefinitionsOf}. */
	callees(this: void, call: NodeId, graph: DataflowGraph): readonly RFunctionDefinition<ParentInformation>[] {
		return Dataflow.calleeDefinitionsOf(graph, call);
	},
	/** The calls within the body of `definition` that it makes itself, not those of the functions it defines. */
	callsWithin(this: void, definition: RFunctionDefinition<ParentInformation>, graph: DataflowGraph): NodeId[] {
		const idMap = graph.idMap;
		return idMap === undefined ? [] : [...RNode.collectAllIds(definition.body)]
			.filter(id => DfgVertex.isFunctionCall(graph.getVertex(id)) && RNode.strictlyEnclosingFunction(id, idMap) === definition.info.id);
	},
	/** Whether the call runs what it calls with the arguments written in it, not with arguments of its own making (`lapply(x, f)`). */
	handsOwnArguments(this: void, vertex: DataflowGraphVertexArgument | undefined): vertex is DataflowGraphVertexFunctionCall {
		return DfgVertex.isFunctionCall(vertex) && (vertex.origin === 'unnamed' || DfgVertex.hasOrigin(vertex, BuiltInProcName.Function));
	},
	/**
	 * The known calls of `definition`, `undefined` if it may run with arguments flowR does not see: when it has no call,
	 * or a call runs it with arguments of its own making (`lapply(x, f)`, `do.call(f, args)`).
	 */
	callersOf<Info>(this: void, definition: RFunctionDefinition<Info & ParentInformation>, graph: DataflowGraph): RFunctionCall<ParentInformation>[] | undefined {
		const callers = Dataflow.sourcesOf(graph, definition.info.id, EdgeType.Calls);
		const calls: RFunctionCall<ParentInformation>[] = [];
		for(const caller of callers) {
			const vertex = graph.getVertex(caller);
			const node = graph.idMap?.get(caller);
			if(!CallSites.handsOwnArguments(vertex) || !RFunctionCall.is(node)) {
				return undefined;
			}
			calls.push(node);
		}
		return calls.length === 0 ? undefined : calls;
	},
	/** Per formal of the definition, the arguments of the call bound to it, several only for the dots. */
	bind<Info>(this: void, { call, definition }: CallSite<Info>): PotentiallyEmptyRArgument<Info & ParentInformation>[][] {
		const matched = matchArgumentsToParameters(call.arguments.map(argumentName), formalNames(definition));
		const bound = definition.parameters.map((): PotentiallyEmptyRArgument<Info & ParentInformation>[] => []);
		call.arguments.forEach((arg, i) => {
			if(arg !== EmptyArgument && matched[i] !== undefined) {
				bound[matched[i]].push(arg);
			}
		});
		return bound;
	},
	/**
	 * The arguments `args` with the one at `at` seen from the call `site`: a forwarded `...` becomes what the call gives to the dots,
	 * a parameter becomes what the call gives to it (keeping the name it is handed on under), its default if the call gives none,
	 * and missing if there is no default either. What the call hands on for the parameter in turn (`g(...)`) stays as it is.
	 */
	substitute<Info>(this: void, args: Args<Info>, at: number, site: CallSite<Info>, graph: DataflowGraph): PotentiallyEmptyRArgument<Info & ParentInformation>[] {
		const arg = args[at];
		const value = RArgument.valueOf(arg);
		const parameter = value === undefined ? undefined : parameterAt<Info>(value.info.id, graph);
		if(arg === EmptyArgument || parameter === undefined || parameter[0] !== site.definition) {
			return [...args];
		}
		const index = parameter[1];
		const given = CallSites.bind(site)[index];
		const formal = site.definition.parameters[index];
		let replaced: PotentiallyEmptyRArgument<Info & ParentInformation>[];
		if(formal.special) {
			replaced = arg.name === undefined ? given : [arg];
		} else if(given.length === 1 && given[0] !== EmptyArgument && given[0].value !== undefined && !(given[0].name === undefined && RSymbol.is(given[0].value) && given[0].value.content === DotsParameterName)) {
			replaced = [{ ...given[0], name: arg.name }];
		} else if(given.length === 0) {
			replaced = [formal.defaultValue === undefined ? EmptyArgument : { ...arg, value: formal.defaultValue }];
		} else {
			replaced = [arg];
		}
		return [...args.slice(0, at), ...replaced, ...args.slice(at + 1)];
	},
	/**
	 * The argument lists the arguments `args` of a call stand for across the calls that reach it, one per chain of calls:
	 * each argument handing on a parameter of a function (`...`, or `x` of `function(x)`) is replaced by what the call in `sites`
	 * running that function gives, or else by what each known call of it gives (see {@link CallSites.callersOf}).
	 * An argument no known call settles stays as written, so what it stands for stays open.
	 */
	contexts<Info>(this: void, args: Args<Info>, graph: DataflowGraph, sites: readonly CallSite<Info>[] = []): PotentiallyEmptyRArgument<Info & ParentInformation>[][] {
		type Arg = PotentiallyEmptyRArgument<Info & ParentInformation>;
		const done: Arg[][] = [];
		/* per list, how many calls deep it is and the arguments left as they are, as no call settles them or one hands them back */
		const work: [list: Arg[], depth: number, kept: ReadonlySet<Arg>][] = [[[...args], 0, new Set()]];
		while(work.length > 0) {
			const [list, depth, kept] = work.pop() as [Arg[], number, ReadonlySet<Arg>];
			const at = list.findIndex(a => a !== EmptyArgument && !kept.has(a) && a.value !== undefined && parameterAt(a.value.info.id, graph) !== undefined);
			if(at < 0) {
				done.push(list);
				continue;
			}
			const arg = list[at] as Exclude<Arg, typeof EmptyArgument>;
			const [definition, index] = parameterAt<Info>(arg.value?.info.id ?? -1, graph) as [RFunctionDefinition<Info & ParentInformation>, number];
			const own = sites.filter(s => s.definition === definition);
			const callers = own.length > 0 ? own : depth >= MaxDepth ? undefined : CallSites.callersOf(definition, graph)?.map(call => ({ call, definition }) as CallSite<Info>);
			if(callers === undefined) {
				work.push([list, depth, new Set([...kept, arg])]);
				continue;
			}
			for(const site of callers) {
				const next = CallSites.substitute(list, at, site, graph);
				const fresh = next.filter(a => a !== EmptyArgument && !list.includes(a));
				const again = fresh.filter(a => a !== EmptyArgument && a.value !== undefined && isSameParameter(parameterAt(a.value.info.id, graph), definition, index));
				/* a call handing the parameter back to itself and nothing else (`g(n - 1, ...)` within `g`) gives what the other calls give, with more it stays open */
				if(again.length === 0 || again.length < fresh.length) {
					work.push([next, depth + 1, new Set([...kept, arg, ...again])]);
				}
			}
			if(done.length + work.length > MaxContexts) {
				return [[...args]];
			}
		}
		return done.length === 0 ? [[...args]] : done;
	}
} as const;
