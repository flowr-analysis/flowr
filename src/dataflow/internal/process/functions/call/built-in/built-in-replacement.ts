import type { DataflowProcessorInformation } from '../../../../../processor';
import { type DataflowInformation, initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { expensiveTrace } from '../../../../../../util/log';
import { type ForceArguments, patchFunctionCall, processAllArguments } from '../common';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { VertexType } from '../../../../../graph/vertex';
import { getReferenceOfArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { unpackArg, unpackNonameArg } from '../argument/unpack-argument';
import { symbolArgumentsToStrings } from './built-in-access';
import { builtInId, BuiltInProcessorMapper, BuiltInProcName } from '../../../../../environments/built-in';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { handleReplacementOperator } from '../../../../../graph/unknown-replacement';
import { S7DispatchSeparator } from './built-in-s-seven-dispatch';
import { toUnnamedArgument } from '../argument/make-argument';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { invalidRange } from '../../../../../../util/range';


/**
 * Process a replacement function call like `<-`, `[[<-`, `$<-`, etc.
 * These are automatically created when doing assignments like `x[y] <- value` or in general `fun(x) <- value` will call `fun<- (x, value)`.
 */
export function processReplacementFunction<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/** The last one has to be the value */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { makeMaybe?: boolean, constructName?: 's7', assignmentOperator?: '<-' | '<<-', readIndices?: boolean, assignRootId?: NodeId } & ForceArguments
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Replacement ${Identifier.getName(name.content)} has less than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* we only get here if <-, <<-, ... or whatever is part of the replacement is not overwritten */
	expensiveTrace(dataflowLogger, () => `Replacement ${Identifier.getName(name.content)} with ${JSON.stringify(args)}, processing`);

	let targetArg = args[0];
	if(config.constructName === 's7' && targetArg !== EmptyArgument) {
		let tarName = targetArg.lexeme;
		if(args.length > 2 && args[1] !== EmptyArgument) {
			tarName += S7DispatchSeparator + args[1].lexeme;
		}
		const uArg = unpackArg(targetArg) ?? targetArg;
		targetArg = toUnnamedArgument({
			content:  tarName,
			type:     RType.Symbol,
			info:     uArg.info,
			lexeme:   tarName,
			location: uArg.location ?? invalidRange()
		} satisfies RSymbol<ParentInformation>, data.completeAst.idMap);
	}

	/* we assign the first argument by the last for now and maybe mark as maybe!, we can keep the symbol as we now know we have an assignment */
	let res = BuiltInProcessorMapper[BuiltInProcName.Assignment](
		name,
		[targetArg, args.at(-1) as RFunctionArgument<OtherInfo & ParentInformation>],
		rootId,
		data,
		{
			superAssignment:  config.assignmentOperator === '<<-',
			makeMaybe:        config.makeMaybe,
			canBeReplacement: true
		}
	);

	const createdVert = res.graph.getVertex(rootId);
	if(createdVert?.tag === VertexType.FunctionCall) {
		createdVert.origin = [BuiltInProcName.Replacement];
	}
	const targetVert = res.graph.getVertex(unpackArg(args[0])?.info.id as NodeId);
	if(targetVert?.tag === VertexType.VariableDefinition) {
		(targetVert as { par: boolean }).par = true;
	}

	const convertedArgs = config.readIndices ? args.slice(1, -1) : symbolArgumentsToStrings(args.slice(1, -1), 0);

	/* now, we soft-inject other arguments, so that calls like `x[y] <- 3` are linked correctly */
	const { callArgs } = processAllArguments({
		functionName:   initializeCleanDataflowInformation(rootId, data),
		args:           convertedArgs,
		data,
		functionRootId: rootId,
		finalGraph:     res.graph,
		forceArgs:      config.forceArgs,
	});

	patchFunctionCall({
		nextGraph: res.graph,
		data,
		rootId,
		name,
		argumentProcessResult:
			args.map(a => a === EmptyArgument ? undefined : { entryPoint: unpackNonameArg(a)?.info.id as NodeId }),
		origin: BuiltInProcName.Replacement,
		link:   config.assignRootId ? { origin: [config.assignRootId] } : undefined
	});

	const firstArg = unpackNonameArg(args[0]);

	handleReplacementOperator({
		operator: name.content,
		target:   firstArg?.lexeme,
		env:      res.environment,
		id:       rootId
	});

	if(firstArg) {
		res.graph.addEdge(
			firstArg.info.id,
			rootId,
			EdgeType.DefinedBy | EdgeType.Reads
		);
	}

	/* a replacement reads all of its call args as well, at least as far as I am aware of */
	for(const arg of callArgs) {
		const ref = getReferenceOfArgument(arg);
		if(ref !== undefined) {
			res.graph.addEdge(rootId, ref, EdgeType.Reads);
		}
	}

	const fa = unpackNonameArg(args[0]);
	if(fa) {
		res = {
			...res,
			in: [...res.in, { name: fa.lexeme, type: ReferenceType.Variable, nodeId: fa.info.id, cds: data.cds }]
		};
	}

	// dispatches actually as S3:
	const fns = res.in.filter(i => i.nodeId === rootId);
	for(const fn of fns) {
		(fn as { type: ReferenceType }).type = ReferenceType.S3MethodPrefix;
	}
	// link the built-in replacement op
	res.graph.addEdge(rootId, builtInId(Identifier.getName(name.content)), EdgeType.Calls | EdgeType.Reads);
	return res;
}