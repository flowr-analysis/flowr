import { type DataflowProcessorInformation, processDataflowFor } from '../../../../processor';
import { FnSig } from '../../../../environments/built-in-props';
import type { ExitPoint, DataflowInformation } from '../../../../info';
import { ExitPointType } from '../../../../info';
import { processAllArguments } from './common';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { type IdentifierReference, ReferenceType } from '../../../../environments/identifier';
import type { FunctionArgument } from '../../../../graph/graph';
import { DataflowGraph } from '../../../../graph/graph';
import { EdgeType } from '../../../../graph/edge';
import { ControlFlow } from '../../../control-flow';
import { dataflowLogger } from '../../../../logger';
import { type FunctionOriginInformation, VertexType } from '../../../../graph/vertex';
import { handleUnknownSideEffect } from '../../../../graph/unknown-side-effect';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { Nse } from './nse';

export interface ProcessKnownFunctionCallInput<OtherInfo> {
	/** the signature of the called function, the one place stating which arguments it evaluates */
	readonly sig?:                  FnSig
	/** The name of the function being called. */
	readonly name:                  RSymbol<OtherInfo & ParentInformation>
	/** The arguments to the function call. */
	readonly args:                  readonly (RNode<OtherInfo & ParentInformation> | PotentiallyEmptyRArgument<OtherInfo & ParentInformation>)[]
	/** The node ID to use for the function call vertex. */
	readonly rootId:                NodeId
	/** The dataflow processor information at the point of the function call. */
	readonly data:                  DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** should arguments be processed from right to left? This does not affect the order recorded in the call but of the environments */
	readonly reverseOrder?:         boolean
	/** which arguments are {@link NseKind.Reevaluated|reevaluated}, like a loop body */
	readonly markAsNSE?:            readonly number[]
	/** allows passing a data processor in-between each argument */
	readonly patchData?:            (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, arg: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** Does the call have a side effect that we do not know a lot about which may have further consequences? */
	readonly hasUnknownSideEffect?: boolean
	/** The origin to use for the function being called. */
	readonly origin:                FunctionOriginInformation | 'default'
	/** see {@link ProcessAllArgumentInput#nonFunction} */
	readonly nonFunction?:          ReadonlySet<NodeId>
	/**
	 * Suppress the default control flow linkage (arguments in order, then the call).
	 * Constructs that branch or loop set this and wire their control flow themselves.
	 */
	readonly customControlFlow?:    boolean
	/**
	 * From this argument index on, the arguments are alternatives of which at most one is evaluated,
	 * which is how `switch` picks an arm. The arguments before it are evaluated in order as usual.
	 */
	readonly alternativeArgsFrom?:  number
}

/** The result of processing a known function call. */
export interface ProcessKnownFunctionCallResult {
	/** This is the overall information about the function call itself. */
	readonly information:        DataflowInformation
	/** The processed arguments in order, they are included in the information but sometimes useful separately. */
	readonly processedArguments: readonly (DataflowInformation | undefined)[]
	/** A reference to the function being called. */
	readonly fnRef:              IdentifierReference
	/**
	 * The arguments as recorded on the function call vertex.
	 * They are also part of the information via the function call vertex adde, but sometimes useful separately.
	 * For example, together with {@link pMatch} to do custom parameter matching.
	 */
	readonly callArgs:           readonly FunctionArgument[]
}

/**
 * Which arguments of a call {@link markArgumentsAsNonStandardEvaluation|are non-standardly evaluated}:
 * every argument, all but the (data) first one, or only the first one.
 */
export enum NseArguments {
	/** every argument, e.g. the operands of a formula `~` or `aes(x, y)` */
	All         = 'all',
	/** all but the first, e.g. `subset(data, col > 1)` where the first argument is the data object */
	AllButFirst = 'all-but-first',
	/** only the first, e.g. the native routine name in `.C(routine, ...)` */
	First       = 'first'
}

/**
 * How an argument escapes standard evaluation, which decides what is marked
 * {@link EdgeType.NonStandardEvaluation}.
 */
export enum NseKind {
	/** the argument is not evaluated at all (`quote(x + y)`), so nothing within it is */
	Quoted      = 'quoted',
	/** the argument is evaluated in a data mask (`subset(d, a > k)`), where only its symbols may name columns */
	DataMasked  = 'data-masked',
	/** evaluated, just not exactly once (a loop body), so only the argument itself is marked */
	Reevaluated = 'reevaluated'
}

export interface NseMarkOptions {
	readonly kind?:      NseKind
	/** ids an unquote escape splices back in, see {@link Nse.unquoted} */
	readonly evaluated?: ReadonlySet<NodeId>
}

/**
 * Marks the selected arguments as {@link EdgeType.NonStandardEvaluation}: a {@link NseKind.Quoted|quoted} one
 * entirely, a {@link NseKind.DataMasked|data-masked} one only where {@link Nse.suppliedByMask} holds, and a
 * {@link NseKind.Reevaluated|reevaluated} one as a whole but not within.
 */
export function markArgumentsAsNonStandardEvaluation(
	graph:              DataflowGraph,
	rootId:             NodeId,
	processedArguments: readonly (DataflowInformation | undefined)[],
	which:              NseArguments | readonly number[] | undefined,
	{ kind = NseKind.Quoted, evaluated }: NseMarkOptions = {}
): void {
	if(which === undefined) {
		return;
	}

	if(typeof which !== 'string') {
		for(const i of which) {
			if(i < processedArguments.length) {
				markArgument(graph, rootId, processedArguments[i], kind, evaluated);
			} else {
				dataflowLogger.warn(`Trying to mark argument ${i} as non-standard-evaluation, but only ${processedArguments.length} arguments are available`);
			}
		}
		return;
	}
	const end = which === NseArguments.First ? 1 : processedArguments.length;
	for(let i = which === NseArguments.AllButFirst ? 1 : 0; i < end; i++) {
		markArgument(graph, rootId, processedArguments[i], kind, evaluated);
	}
}

function markArgument(graph: DataflowGraph, rootId: NodeId, arg: DataflowInformation | undefined, kind: NseKind, evaluated: ReadonlySet<NodeId> | undefined): void {
	if(arg === undefined) {
		return;
	}
	if(kind !== NseKind.DataMasked) {
		graph.addEdge(rootId, arg.entryPoint, EdgeType.NonStandardEvaluation);
	}
	if(kind === NseKind.Reevaluated) {
		return;
	}
	for(const [vtx, info] of arg.graph.vertices(true)) {
		if(evaluated?.has(vtx)) {
			continue;
		}
		/* every name in a mask is a candidate column, even one the caller binds: R asks the data first.
		   {@link Nse.dropResolvedMask} takes the mark off the bound ones again, and keeps them as the
		   names that mean both */
		if(kind === NseKind.Quoted || Nse.maskCandidate(info)) {
			graph.addEdge(rootId, vtx, EdgeType.NonStandardEvaluation);
		}
	}
}

/**
 * The main processor for function calls for which we know the target but need not
 * add any specific handling.
 */
export function processKnownFunctionCall<OtherInfo>(
	{ name, args, rootId, data, reverseOrder = false, markAsNSE = undefined, sig, patchData = d => d, hasUnknownSideEffect, origin, nonFunction, customControlFlow, alternativeArgsFrom }: ProcessKnownFunctionCallInput<OtherInfo>,
): ProcessKnownFunctionCallResult {
	const functionName = processDataflowFor(name, data);
	const finalGraph = new DataflowGraph(data.completeAst.idMap);
	const functionCallName = name.content;
	const processArgs = reverseOrder ? args.toReversed() : args;
	const forced = FnSig.forced(sig, processArgs.length);

	const {
		finalEnv,
		callArgs,
		remainingReadInArgs,
		processedArguments
	} = processAllArguments<OtherInfo>({ functionName, args: processArgs, data, finalGraph, functionRootId: rootId, patchData, forced, nonFunction });
	markArgumentsAsNonStandardEvaluation(finalGraph, rootId, processedArguments, markAsNSE, { kind: NseKind.Reevaluated });

	const onlyBuiltin = data.builtInNoEnv === rootId;
	finalGraph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          rootId,
		environment: onlyBuiltin ? undefined : data.environment,
		name:        functionCallName,
		/* may still be overwritten by markAsOnlyBuiltIn */
		onlyBuiltin,
		cds:         data.cds,
		args:        reverseOrder ? callArgs.toReversed() : callArgs,
		origin:      origin === 'default' ? [BuiltInProcName.Function] : [origin]
	}, data.ctx.env.cleanEnv);

	if(hasUnknownSideEffect) {
		handleUnknownSideEffect(finalGraph, data.environment, rootId);
	}

	const inIds = remainingReadInArgs;
	const fnRef: IdentifierReference = { nodeId: rootId, name: functionCallName, cds: data.cds, type: ReferenceType.Function };
	inIds.push(fnRef);

	// if force args is not none, we need to collect all non-default exit points from our arguments!
	let exitPoints: ExitPoint[] | undefined = undefined;
	/* a jump that only happens under a condition still lets the call complete, so its default exit has to stay */
	let alwaysJumps = false;
	if(forced) {
		for(let i = 0; i < processedArguments.length; i++) {
			const p = processedArguments[i];
			if(p === undefined || !forced[i]) {
				continue;
			}
			const before = exitPoints?.length ?? 0;
			for(const exit of p.exitPoints) {
				if(exit.type !== ExitPointType.Default) {
					(exitPoints ??= []).push(exit);
				}
			}
			alwaysJumps ||= (exitPoints?.length ?? 0) > before && ControlFlow.alwaysExits(p);
		}
		if(exitPoints !== undefined && !alwaysJumps) {
			exitPoints.push({ nodeId: rootId, type: ExitPointType.Default, cds: data.cds });
		}
	}

	/* an alternative without a name is the default arm, which runs when nothing else matched */
	const cfgEntry = customControlFlow ? rootId
		: alternativeArgsFrom === undefined ? ControlFlow.inSequence(finalGraph, processedArguments, rootId)
			: ControlFlow.picksOneOf(finalGraph, processedArguments, alternativeArgsFrom, rootId,
				processArgs.slice(alternativeArgsFrom).some(a => a !== EmptyArgument && (!RArgument.is(a) || a.name === undefined)));
	if(!customControlFlow) {
		/*
		 * A jump within an argument that the call does not pass on is caught here (the callee decides whether it
		 * ever forces that argument), so control resumes at the call rather than leaving it.
		 */
		for(const argument of processedArguments) {
			for(const exit of argument?.exitPoints ?? []) {
				/*
				 * A jump within an argument the call does not pass on resumes at the call. A `return` leaves the
				 * enclosing function wherever the argument runs at all, so only a call that never evaluates it
				 * may catch one (see `processQuote`).
				 */
				if(exit.type !== ExitPointType.Default && exit.type !== ExitPointType.Return && !exitPoints?.includes(exit)) {
					finalGraph.addEdge(exit.nodeId, rootId, EdgeType.FlowEdge);
				}
			}
		}
	}

	return {
		information: {
			unknownReferences: [],
			in:                inIds,
			/* we do not keep the argument out as it has been linked by the function */
			out:               functionName.out,
			graph:             finalGraph,
			environment:       finalEnv,
			entryPoint:        rootId,
			cfgEntry:          cfgEntry === rootId ? undefined : cfgEntry,
			exitPoints:        exitPoints ?? [{ nodeId: rootId, type: ExitPointType.Default, cds: data.cds }],
			hooks:             functionName.hooks
		},
		callArgs,
		processedArguments: reverseOrder ? processedArguments.toReversed() : processedArguments,
		fnRef
	};
}
