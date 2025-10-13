import { FlowrConfigOptions } from "../../config";
import { ControlFlowInformation } from "../../control-flow/control-flow-graph";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { NormalizedAst, ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { AbstractOperationsStringDomain } from "./domain";
import { ConstStringDomain } from "./domains/constant";
import { ConstSetStringDomain } from "./domains/constant-set";
import { StringDomainInfo, StringDomainVisitor } from "./visitor";

export function createDomain(config: FlowrConfigOptions): AbstractOperationsStringDomain | undefined {
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
	const domain = createDomain(config);
	if (!domain) return;
	
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
