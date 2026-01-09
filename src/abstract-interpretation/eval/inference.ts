import { FlowrConfigOptions } from "../../config";
import { ControlFlowInformation } from "../../control-flow/control-flow-graph";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { NormalizedAst, ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { Domain, Lift, Value } from "./domain";
import { ConstDomain } from "./domains/constant";
import { ConstSetDomain } from "./domains/constant-set";
import { PresuffixDomain } from "./domains/presuffix";
import { NodeId } from "./graph";
import { StringDomainVisitor } from "./visitor";

export function createDomain(config: FlowrConfigOptions): Domain<any> | undefined {
	const domain = config.abstractInterpretation.string.domain
	switch (domain) {
		case "const":
			return ConstDomain

		case "const-set":
			return ConstSetDomain

		case "presuffix":
			return PresuffixDomain

		default:
			throw new Error(`unknown string domain: ${domain}`)
	}
}

export function inferStringDomains(
	cfinfo: ControlFlowInformation,
	dfg: DataflowGraph,
	ast: NormalizedAst<ParentInformation>,
	config: FlowrConfigOptions
): Map<NodeId, Lift<Value>> {
	const visitor = new StringDomainVisitor({ controlFlow: cfinfo, dfg: dfg, normalizedAst: ast, flowrConfig: config });
	visitor.start()
	const domain = createDomain(config)! as unknown as Domain<Value>
	const values = visitor.graph.inferValues(domain)
	return values
}
