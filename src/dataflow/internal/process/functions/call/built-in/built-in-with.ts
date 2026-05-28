
import type { DataflowProcessorInformation } from '../../../../../processor';
import { processDataflowFor } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../../../../../environments/identifier';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { resolveEnvirArg, routeWrittenToCustomEnv } from './built-in-envir-utils';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { patchFunctionCall } from '../common';
import { EdgeType } from '../../../../../graph/edge';
import { linkInputs } from '../../../../linker';

/**
 * Processes `with(data, expr)` and `within(data, expr)`.
 *
 * When `data` is a variable that holds a tracked {@link InGraphIdentifierDefinition#envState},
 * the expression `expr` is evaluated in that environment's scope so that reads of names
 * defined there resolve correctly.
 *
 * - `with`: writes in `expr` are ephemeral (R's `with` uses a temporary scope and discards them).
 * - `within`: writes in `expr` are persisted back into the tracked envState of `data`.
 *
 * Falls back to a normal function-call analysis when the data argument cannot be resolved
 * to a tracked environment.
 */
export function processWithEnv<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(args.length < 2) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.With }).information;
	}

	const dataArg = args[0];
	const exprArg = args[1];

	if(dataArg === EmptyArgument || exprArg === EmptyArgument || !dataArg.value || !exprArg.value) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.With }).information;
	}

	/* `data` is the first positional arg (or may be passed as `data=`) */
	const envirResolution = resolveEnvirArg(args, data, 'data', 0);
	if(!envirResolution) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.With }).information;
	}

	/* evaluate data arg in the caller's scope (it is just read) */
	const dfDataArg = processDataflowFor(dataArg.value, data);

	/* evaluate expr in the resolved env's scope so variable lookup uses envState */
	const dfExpr = processDataflowFor(exprArg.value, {
		...data,
		environment: envirResolution.envirData.environment
	});

	/*
	 * processSymbol puts symbol uses in unknownReferences without creating reads edges.
	 * Explicitly link expr's unknown references against the envState so reads edges are
	 * created for names that resolve there (e.g. `x` in `with(e, x)` → assign).
	 * References that cannot be resolved in envState are kept for the outer scope.
	 */
	const remainingFromExpr: IdentifierReference[] = [];
	linkInputs(dfExpr.unknownReferences, envirResolution.envirData.environment, remainingFromExpr, dfExpr.graph, false);

	patchFunctionCall({
		nextGraph:             dfDataArg.graph,
		rootId,
		name,
		data,
		argumentProcessResult: [dfDataArg, dfExpr],
		origin:                BuiltInProcName.With
	});

	const merged = dfDataArg.graph.mergeWith(dfExpr.graph);
	/* direct reads edge so the slicer can reach the env variable from the with call */
	merged.addEdge(rootId, envirResolution.envirNodeId, EdgeType.Reads);

	const ingoing = dfDataArg.in.concat(
		dfExpr.in,
		dfDataArg.unknownReferences,
		remainingFromExpr,  /* unresolved expr refs propagate to outer scope */
		[{ nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function }]
	);

	/* within routes body writes back into the data environment; with discards them */
	const isWithin = Identifier.getName(name.content) === 'within';
	let resultEnv = data.environment;
	if(isWithin && dfExpr.out.length > 0) {
		const tempResult = { ...dfExpr, environment: data.environment };
		resultEnv = routeWrittenToCustomEnv(tempResult, envirResolution.envDef, rootId).environment;
	}

	return {
		hooks:             dfDataArg.hooks.concat(dfExpr.hooks),
		environment:       resultEnv,
		exitPoints:        dfDataArg.exitPoints.concat(dfExpr.exitPoints),
		graph:             merged,
		entryPoint:        rootId,
		in:                ingoing,
		out:               [],   /* writes are inside envState, not directly in outer scope */
		unknownReferences: []
	};
}
