import { type DataflowInformation, ExitPointType } from '../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../processor';
import type { RParameter } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type IdentifierDefinition, ReferenceType } from '../../../environments/identifier';
import { define } from '../../../environments/define';
import { EdgeType } from '../../../graph/edge';
import { ControlFlow } from '../../control-flow';
import { Ternary } from '../../../../util/logic';
import { RFunctionDefinition } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

function definedByDefault<OtherInfo>(parameter: RParameter<OtherInfo & ParentInformation>, defaultValue: DataflowInformation | undefined): NodeId[] {
	if(defaultValue === undefined) {
		return [];
	}
	if(RFunctionDefinition.is(parameter.defaultValue)) {
		return [parameter.defaultValue.info.id];
	}
	return defaultValue.in.concat(defaultValue.unknownReferences).map(r => r.nodeId);
}

/**
 * The dataflow of one function parameter: its name becomes a definition in the function's frame, and its
 * default value, if it has one, is processed in the same frame so it may read the parameters before it.
 * @param parameter - the parameter to process
 * @param data      - what the surrounding function definition is being processed with
 */
export function processFunctionParameter<OtherInfo>(parameter: RParameter<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const name = processDataflowFor(parameter.name, data);
	/* a default is a promise the parameter holds, forced where the parameter is first used */
	const defaultValue = parameter.defaultValue === undefined ? undefined : processDataflowFor(parameter.defaultValue, ControlFlow.withinPromise(data, parameter.name.info.id));
	const graph = defaultValue === undefined ? name.graph : name.graph.mergeWith(defaultValue.graph);
	const definedBy = definedByDefault(parameter, defaultValue);

	/* keep the default's environment so its escaping (`<<-`) writes are carried on */
	let environment = defaultValue?.environment ?? name.environment;
	for(const reference of name.unknownReferences) {
		const written = { ...reference, type: ReferenceType.Parameter, definedAt: parameter.info.id } as IdentifierDefinition & { name: string };
		graph.setDefinitionOfVertex(written, defaultValue === undefined ? [] : [defaultValue.entryPoint]);
		environment = define(written, false, environment);
		for(const node of definedBy) {
			graph.addEdge(written.nodeId, node, EdgeType.DefinedBy);
		}
	}

	const boundAt = name.entryPoint;
	if(defaultValue !== undefined) {
		ControlFlow.continuesWith(graph, defaultValue, boundAt);
	}
	/* R only forces a default when the parameter is used, so a jump within one does not cut the binding */
	const defaultExits = ControlFlow.promise(graph, defaultValue, Ternary.Maybe, boundAt);

	return {
		unknownReferences: [],
		in:                defaultValue === undefined ? [] : defaultValue.in.concat(defaultValue.unknownReferences, name.in),
		out:               (defaultValue?.out ?? []).concat(name.out, name.unknownReferences),
		graph,
		environment,
		entryPoint:        parameter.info.id,
		cfgEntry:          defaultValue === undefined ? boundAt : ControlFlow.entryOf(defaultValue),
		cfgExit:           boundAt,
		exitPoints:        [...defaultExits, { nodeId: parameter.info.id, type: ExitPointType.Default, cds: data.cds }],
		hooks:             []
	};
}
