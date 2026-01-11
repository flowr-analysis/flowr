import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { IntervalDomain } from '../abstract-interpretation/domains/interval-domain';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { AstIdMap, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { codeBlock } from './doc-util/doc-code';
import { details, section } from './doc-util/doc-structure';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

class IntervalInferenceVisitor extends AbstractInterpretationVisitor<IntervalDomain> {
	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue, node: RNumber<ParentInformation> }): void {
		super.onNumberConstant({ vertex, node });

		const interval = new IntervalDomain([node.content.num, node.content.num]);
		this.currentState.set(node.info.id, interval);
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		if(call.args.length === 2 && call.args.every(arg => arg !== EmptyArgument)) {
			const left = this.getAbstractValue(call.args[0].nodeId);
			const right = this.getAbstractValue(call.args[1].nodeId);

			if(left === undefined || right === undefined) {
				// If an operand does not have an inferred interval, this might not be a numerical operation
				return;
			}
			// We map the numerical operation to the resulting interval after applying the abstract semantics of the operation
			switch(call.name) {
				case '+':
					return this.currentState.set(call.id, left.add(right));
				case '-':
					return this.currentState.set(call.id, left.subtract(right));
			}
		}
	}
}

async function inferIntervals(): Promise<string> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(`
		x <- if (runif < 0.5) 6 else 12
		y <- 42
		z <- x + y
	`.trim());

	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow();
	const ctx = analyzer.inspectContext();
	const domain = new StateAbstractDomain<IntervalDomain>(new Map());

	const inference = new IntervalInferenceVisitor({ controlFlow: cfg, dfg: dfg, normalizedAst: ast, ctx: ctx, domain: domain });
	inference.start();

	const result = inference.getEndState();

	return result.value.entries().toArray()
		.map(([id, value]) => `${nodeIdToSlicingCriterion(id, ast.idMap)} -> ${value.toString()}`)
		.join('\n');
}

function nodeIdToSlicingCriterion(id: NodeId, idMap: AstIdMap): string {
	const node = idMap.get(id);

	return `${node?.location?.[0]}@${node?.lexeme}`;
}

export class WikiAbsint extends DocMaker<'wiki/Abstract Interpretation.md'> {
	constructor() {
		super('wiki/Abstract Interpretation.md', module.filename, 'abstract interpretation framework');
	}

	protected async text({ ctx }: DocMakerArgs): Promise<string> {
		return `
This page describes the abstract interpretation framework of _flowR_.
Abstract interpretation abstracts the concrete semantics of a program to automatically infer properties about the behavior of a program.
It uses an abstract domain to capture sets of possible runtime values of a program.
An abstract domain is represented by a lattice with a partial order, join operator (least upper bound), meet operator (greated lower bound), top element (greatest element), and bottom element (least element).
Abstract interpretation uses an abstraction of the concrete semantics of a program to perform fixpoint iteration to find program invariants.

${section('Abstract Domains', 2, 'abstract-domains')}

To perform abstract interpretation, we first need to define an abstract domain to capture possible runtime values of the program.
In _flowR_, an abstract domain is represented by the class ${ctx.link(AbstractDomain)} that extends the ${ctx.link('Lattice')} interface. It has the type parameters \`Concrete\` for the concrete domain of the abstract domain (e.g. strings, numbers, lists), \`Abstract\` for the abstract representation of the values (e.g. sets, intervals), \`Top\` for the representation of the top element, \`Bot\` for the representation of the bottom element, and \`Value\` for the type of the current abstract value of the abstract domain (i.e. \`Abstract\`, \`Top\`, or \`Bot\`). An abstract domain provides the following properties and functions:

 * ${ctx.linkM(AbstractDomain, 'value')} the current abstract value of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'leq')}) to check whether to abstract values are ordered with respect to the partial order of the lattice
 * ${ctx.linkM(AbstractDomain, 'join')} to join two abstract values to get the least upper bound (LUB)
 * ${ctx.linkM(AbstractDomain, 'meet')} to meet two abstract values to get the greates lower bound (GLB)
 * ${ctx.linkM(AbstractDomain, 'widen')} to perform widening with another abstract value to ensure termination of the fixpoint iteration
 * ${ctx.linkM(AbstractDomain, 'narrow')} to perform narrowing with another abstract value to refine the abstract value after widening
 * ${ctx.linkM(AbstractDomain, 'top')} to get the top element (greatest element) of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'bottom')} to get the bottom element (least element) of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'concretize')} representing the concretization function of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'abstract')} representing the abstraction function of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'isTop')} to check whether the current abstract value is top
 * ${ctx.linkM(AbstractDomain, 'isBottom')} to check whether the current abstract value is bottom
 * ${ctx.linkM(AbstractDomain, 'isValue')} to check whether the current abstract value is a value (can still be top or bottom)

${details('Class Diagram', `
All boxes link to their respective implementation in the source code.
${codeBlock('mermaid', ctx.mermaid(AbstractDomain))}
`.trim())}

The ${ctx.link('Top')} and ${ctx.link('Bottom')} symbols can be used to explicitly represent the top or bottom elment of an abstract domain. Additionally, for value abstract domains, there is the ${ctx.link('SatisfiableDomain')} interface that provides the function ${ctx.link('SatisfiableDomain:::satisfies')} to check whether the current abstract value of the abstract domain satisfies a concrete value (see also ${ctx.link('NumericalComparator')} and ${ctx.link('SetComparator')}).

_flowR_ already provides different abstract domains for abstract interpretation in [\`src/abstract-interpretation/domains\`](https://github.com/flowr-analysis/flowr/tree/main/src/abstract-interpretation/domains). Many of the abstract domains are generic and can be used for differend kinds of analyses. The existing abstract domains are presented in the following. Some of the listed abstract domains can be expanded to show the inherited abstract domains.

${ctx.hierarchy(AbstractDomain, { collapseFromNesting: 2, skipNesting: 1, reverse: true })}

${details('Class Diagram', `
All boxes link to their respective implementation in the source code.
${codeBlock('mermaid', ctx.mermaid(AbstractDomain, { simplify: true, reverse: true }))}
`.trim())}

${section('Abstract Interpretation', 2, 'abstract-interpretation')}

We forward traverse the ${ctx.linkPage('wiki/Control Flow Graph', 'control flow graph')} of _flowR_ using a ${ctx.link(AbstractInterpretationVisitor)}.

${ctx.code(IntervalInferenceVisitor)}

${ctx.code(inferIntervals,{ dropLinesStart: 1, dropLinesEnd: 5 })}

${codeBlock('ts', await inferIntervals())}
        `;
	}
}
