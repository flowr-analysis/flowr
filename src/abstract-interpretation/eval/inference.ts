import { FlowrConfigOptions } from "../../config";
import { ControlFlowInformation } from "../../control-flow/control-flow-graph";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { NormalizedAst, ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { StringDomain } from "./domain";
import { StringDomainInfo, StringDomainVisitor } from "./visitor";

export function inferStringDomains(
  domain: StringDomain,
	cfinfo: ControlFlowInformation,
	dfg: DataflowGraph,
	ast: NormalizedAst<ParentInformation & StringDomainInfo>,
	config: FlowrConfigOptions
) {
	for (let i = 0; i < 100; i++) {
		console.log(`string domain iteration: ${i}`)
		const visitor = new StringDomainVisitor(domain, { controlFlow: cfinfo, dfg: dfg, normalizedAst: ast, flowrConfig: config });
		visitor.start()

		if(!visitor.dirty) {
			console.log(`string domain inference took ${i} iterations`);
			return;
		}
	}

	console.log('string domain inference exceeded max iterations');
}
