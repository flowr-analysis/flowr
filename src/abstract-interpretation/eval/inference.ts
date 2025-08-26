import { FlowrConfigOptions } from "../../config";
import { ControlFlowInformation } from "../../control-flow/control-flow-graph";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { NormalizedAst, ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { AbstractOperationsStringDomain } from "./domain";
import { ConstStringDomain } from "./domains/constant";
import { ConstSetStringDomain } from "./domains/constant-set";
import { StringDomainInfo, StringDomainVisitor } from "./visitor";

function createDomain(config: FlowrConfigOptions): AbstractOperationsStringDomain {
	switch (config.abstractInterpretation.string.domain) {
		case "const":
			return new ConstStringDomain()

		case "const-set":
			return new ConstSetStringDomain()
	}
}

export function inferStringDomains(
	cfinfo: ControlFlowInformation,
	dfg: DataflowGraph,
	ast: NormalizedAst<ParentInformation & StringDomainInfo>,
	config: FlowrConfigOptions
) {
	for (let i = 0; i < 100; i++) {
		console.log(`string domain iteration: ${i}`)
		const visitor = new StringDomainVisitor(createDomain(config), { controlFlow: cfinfo, dfg: dfg, normalizedAst: ast, flowrConfig: config });
		visitor.start()

		if(!visitor.dirty) {
			console.log(`string domain inference took ${i} iterations`);
			return;
		}
	}

	console.log('string domain inference exceeded max iterations');
}
