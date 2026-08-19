import { AbstractInterpreter, type AbsintAnalysis } from '../abstract-interpretation/absint-inference';
import type { AbstractSemantics } from '../abstract-interpretation/abstract-semantics';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { BoundedSetDomain } from '../abstract-interpretation/domains/bounded-set-domain';
import { IntervalDomain, IntervalTop } from '../abstract-interpretation/domains/interval-domain';
import { Top } from '../abstract-interpretation/domains/lattice';
import { MultiValueDomain, MultiValueStateDomain } from '../abstract-interpretation/domains/multi-value-state-domain';
import type { StateDomain } from '../abstract-interpretation/domains/state-domain';
import { ValueSemantics } from '../abstract-interpretation/value-semantics';
import { FunctionArgument } from '../dataflow/graph/graph';
import { CfgKind } from '../project/cfg-kind';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { AstIdMap } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { codeBlock } from './doc-util/doc-code';
import { linkFlowRSourceFile } from './doc-util/doc-files';
import { details, section } from './doc-util/doc-structure';
import { DocMaker, type DocMakerArgs } from './wiki-mk/doc-maker';

/** The abstract domains of the interval analysis, i.e. a single interval domain named `interval` */
export type IntervalDomains = { interval: IntervalDomain };

/** The abstract semantics of the interval analysis for numeric constants, additions, and subtractions */
export const IntervalSemantics = new ValueSemantics<StateDomain<IntervalDomain>>({
	constants: {
		// For numeric constants, the resulting interval consists just of the value of the constant
		number: (state, vertex, ctx, value) => state.set(vertex.id, IntervalDomain.from(value.num))
	},
	// We map the numerical operations to the resulting interval after applying the abstract semantics of the operation
	functionCalls: {
		'base::+': applyBinaryOp((left, right) => left.add(right)),
		'base::-': applyBinaryOp((left, right) => left.subtract(right))
	}
});

/** The interval analysis inferring the possible numeric values of the expressions of a program */
export const IntervalAnalysis: AbsintAnalysis<IntervalDomains> = {
	domains:   { interval: IntervalDomain.top() },
	semantics: { interval: IntervalSemantics }
};

/** Creates the abstract semantics of a binary numeric operation, such as `+` or `-` */
function applyBinaryOp(
	operation: (left: IntervalDomain, right: IntervalDomain) => IntervalDomain
): AbstractSemantics<StateDomain<IntervalDomain>>['handleFunctionCall'] {
	return (state, vertex, ctx) => {
		if(vertex.args.length !== 2 || !vertex.args.every(FunctionArgument.isNotEmpty)) {
			return;
		}
		const left = ctx.getAbstractValue(vertex.args[0].nodeId, state);
		const right = ctx.getAbstractValue(vertex.args[1].nodeId, state);

		// If an operand does not have an inferred interval, this might not be a numerical operation
		if(left !== undefined && right !== undefined) {
			state.set(vertex.id, operation(left, right));
		}
	};
}

async function inferIntervals(): Promise<string> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(`
		x <- 42
		y <- if (runif(1) < 0.5) 6 else 12
		z <- x + y
	`.trim());

	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow(undefined, CfgKind.NoFunctionDefs);
	const ctx = analyzer.inspectContext();

	const inference = new AbstractInterpreter({ controlFlow: cfg, dfg: dfg, normalizedAst: ast, ctx: ctx }, IntervalAnalysis);
	inference.start();

	const result = inference.getEndState('interval');

	return result.entries()
		.map(([id, value]) => `${nodeIdToSlicingCriterion(id, ast.idMap)} -> ${value.toString()}`)
		.join('\n');
}

function nodeIdToSlicingCriterion(id: NodeId, idMap: AstIdMap): string {
	const node = idMap.get(id);

	return `${node?.location?.[0]}@${node?.lexeme}`;
}

function multiValueExample() {
	const domain = {
		number: new IntervalDomain(IntervalTop),
		string: new BoundedSetDomain<string>(Top)
	};
	const reduction = ({ number, string }: { number?: IntervalDomain, string?: BoundedSetDomain<string> }) => {
		if(number?.isBottom() || string?.isBottom()) {
			return { number: domain.number.bottom(), string: domain.string.bottom() };
		}
		return { number, string };
	};
	const state = new MultiValueStateDomain(new Map(), domain, [reduction]);
	state.setValue(0, 'number', new IntervalDomain([42, 42]));
	state.setValue(1, 'string', new BoundedSetDomain(new Set(['Hello world!'])));
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
 * ${ctx.linkM(AbstractDomain, 'top')} to get the top element (greatest element) of the abstract domain
 * ${ctx.linkM(AbstractDomain, 'bottom')} to get the bottom element (least element) of the abstract domain

 - ${ctx.linkM(AbstractDomain, 'isTop')} to check whether the current abstract value is top
 - ${ctx.linkM(AbstractDomain, 'isBottom')} to check whether the current abstract value is bottom
 - ${ctx.linkM(AbstractDomain, 'isValue')} to check whether the current abstract value is a value (can still be top or bottom)

 * ${ctx.linkM(AbstractDomain, 'leq')} to check whether two abstract values are ordered with respect to the partial order of the lattice
 * ${ctx.linkM(AbstractDomain, 'join')} to join two abstract values to get the least upper bound (LUB)
 * ${ctx.linkM(AbstractDomain, 'meet')} to meet two abstract values to get the greates lower bound (GLB)
 * ${ctx.linkM(AbstractDomain, 'widen')} to perform widening with another abstract value to ensure termination of the fixpoint iteration
 * ${ctx.linkM(AbstractDomain, 'narrow')} to perform narrowing with another abstract value to refine the abstract value after widening

The ${ctx.link('Top')} and ${ctx.link('Bottom')} symbols can be used to explicitly represent the top or bottom elment of an abstract domain. Additionally, for value abstract domains, there is the ${ctx.link('SatisfiableDomain')} interface that provides the function ${ctx.link('SatisfiableDomain:::satisfies')} to check whether the current abstract value of the abstract domain satisfies a concrete value (see also ${ctx.link('NumericalComparator')} and ${ctx.link('SetComparator')}).

_flowR_ already provides different abstract domains for abstract interpretation in ${linkFlowRSourceFile('src/abstract-interpretation/domains')}. Many of the abstract domains are generic and can be used for differend kinds of analyses. The existing abstract domains are presented in the following. Some of the listed abstract domains can be expanded to show the inherited abstract domains.

${ctx.hierarchy(AbstractDomain, { collapseFromNesting: 2, skipNesting: 1, reverse: true })}

${details('Class Diagram', `
All boxes link to their respective implementation in the source code.
${codeBlock('mermaid', ctx.mermaid(AbstractDomain, { simplify: true, reverse: true }))}
`.trim())}

Multiple abstract domains can be combined using a ${ctx.link(MultiValueDomain)} (for example, to use an interval domain for numbers and bounded set domain for strings at the same time). A multi-value state domain (${ctx.link(MultiValueStateDomain)}) as state domain of a multi-value domain can be used to track the state of multiple value domains in a program. Additionally, is enables to define reductions on the multi-value domain to refine the inferred value for a value domain based on the other value domains in the multi-value domain. For example, the following example shows how a multi-value state domain can be defined to track numbers and strings at the same time with a simple reduction that sets both domains to bottom if one domain is bottom.

${ctx.code(multiValueExample, { dropLinesStart: 1, dropLinesEnd: 1, hideDefinedAt: true })}

${section('Abstract Interpretation', 2, 'abstract-interpretation')}

We perform abstract interpretation by forward-traversing the ${ctx.linkPage('wiki/Control Flow Graph', 'control flow graph')} of _flowR_ using an ${ctx.link(AbstractInterpreter)}. For each visited control flow vertex, the abstract interpreter retrieves the current abstract state by joining the abstract states of the predecessors, applies the abstract semantics of the visited control flow vertex to the current state, and updates the abstract state of the currently visited vertex to the current state. The abstract interpreter already handles (delayed) widening at widening points. However, the abstract interpreter does not yet support interprocedural abstract interpretation.

An abstract interpretation analysis is described declaratively by an ${ctx.link('AbsintAnalysis')} which is executed using the ${ctx.link(AbstractInterpreter)}. An abstract interpretation analysis consists of

 * \`domains\` — the value abstract domains to infer as a Cartesian product, mapping a name to an instance of the respective abstract domain (the abstract state maps each AST node to the values of _all_ of these domains, so multiple analyses can share a single traversal),
 * \`semantics\` — the ${ctx.link('AbstractSemantics')} to apply for each of these domains, and
 * \`reductions\` — optional reduction functions of the product domain refining the value of one domain based on the values of the others.

The ${ctx.link('AbstractSemantics')} for a domain define the abstract semantics of different R constructs with respect to the current abstract state (e.g., ${ctx.link('AbstractSemantics:::handleFunctionCall')}, ${ctx.link('AbstractSemantics:::handleReplacementCall')}, or ${ctx.link('AbstractSemantics:::handleNumberConstant')}). All handlers are optional and receive the current abstract \`state\` to update in place, the dataflow graph vertex of the visited construct, and an ${ctx.link('AbsintContext')} providing access to the analyzed program and to the inferred abstract values (e.g., ${ctx.link('AbsintContext:::getAbstractValue')} to resolve the inferred value of an AST node, which includes resolving symbols, pipes, and if expressions).

The abstract semantics for a (non-relational) abstract domain can be defined declaratively using ${ctx.link(ValueSemantics)} that receives a record of abstract semantics for constants, function calls, accesses, replacement calls, and condition semantics. Function calls, accesses and replacement calls are dispatched by their qualified name (e.g., \`dplyr::filter\`), so that the semantics of a function are only applied if the called function may actually originate from the expected package. Additionally, ${ctx.link(ValueSemantics)} provides default semantics for assignments by assigning the abstract value of the source to the assignment target.

After the abstract interpreter is started with ${ctx.linkM(AbstractInterpreter, 'start', { hideClass: true })}, it provides the following functions to retrieve the inferred values:

 * ${ctx.linkM(AbstractInterpreter, 'getAbstractValue')} to resolve the inferred abstract value of a domain for an AST node (this includes resolving symbols, pipes, and if expressions)
 * ${ctx.linkM(AbstractInterpreter, 'getAbstractState')} to get the inferred abstract state of a domain at an AST node mapping AST nodes to the abstract value of the domain
 * ${ctx.linkM(AbstractInterpreter, 'getAbstractTrace')} to get the complete abstract trace mapping AST nodes to abstract states at the respective node
 * ${ctx.linkM(AbstractInterpreter, 'getEndState')} to get the inferred abstract state at the end of the program (at the exit points of the control flow graph)

For example, if we want to perform a (very basic) interval analysis using abstract interpretation in _flowR_, we can define the following analysis using the ${ctx.link(IntervalDomain)}:

${ctx.code('IntervalDomains', { hideDefinedAt: true })}

${ctx.code('IntervalSemantics', { hideDefinedAt: true })}

${ctx.code('IntervalAnalysis', { hideDefinedAt: true })}

${ctx.code(applyBinaryOp, { hideDefinedAt: true })}

The semantics of the analysis first define the semantics of numeric constants, for which the resulting interval consists just of the value of the constant. We update the abstract state by setting the abstract value of the currently visited constant vertex to this new interval.

In this simple example, we only want to support the addition and subtraction of numeric values. Therefore, we define the semantics of the functions \`base::+\` and \`base::-\` to apply the abstract semantics of additions and subtractions with respect to the interval domain. For the addition and subtraction, we are only interested in function calls with exactly two non-empty arguments. We first resolve the currently inferred abstract value for the left and right operand of the function call. If we have not inferred a value for one of the operands, this function call might not be a numeric function call and we ignore it. Otherwise, we again update the abstract state by setting the abstract value of the currently visited function call vertex to the abstract value resulting from applying the abstract semantics of the operation to the operands.

The data frame shape inference in ${linkFlowRSourceFile('src/abstract-interpretation/data-frame')} provides a more comprehensive example of such an abstract interpretation analysis.

If we now want to run the interval inference, we can write the following code:

${ctx.code(inferIntervals, { dropLinesStart: 1, dropLinesEnd: 5, hideDefinedAt: true })}

We first need a ${ctx.linkPage('wiki/Analyzer', 'flowR analyzer')} (in this case, using the ${ctx.linkPage('wiki/Engines', 'tree-sitter engine')}). In this example, we want to analyze a small example code that assigns \`42\` to the variable \`x\`, randomly assigns \`6\` or \`12\` to the variable \`y\`, and assignes the sum of \`x\` and \`y\` to the variable \`z\`. For the abstract interpreter, we need to retrieve the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')}, ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}, ${ctx.linkPage('wiki/Control Flow Graph', 'control flow graph')}, and context of the flowR anaylzer. For performance reasons, we construct the control flow graph without simplification passes, data flow information, and function definitions. We then create a new ${ctx.link(AbstractInterpreter)} using the control flow graph, dataflow graph, normalized AST, and analyzer context together with our interval analysis, and start the abstract interpreter using ${ctx.linkM(AbstractInterpreter, 'start', { hideClass: true })}. After the abstract interpreter is finished, we retrieve the inferred abstract state at the end of the program using ${ctx.linkM(AbstractInterpreter, 'getEndState', { hideClass: true })}.

If we now print the inferred abstract state at the end of the program, we get the following output:

${codeBlock('ts', await inferIntervals())}
<i>The output has been prettified for better readability.</i>

The AST nodes are represented as slicing criteria for better readability in the format \`<line>@<lexeme>\`. Here, the constants \`42\`, \`0.5\`, \`6\`, and \`12\` of line 1 and 2 are mapped to the intervals \`[42, 42]\`, \`[0.5, 0.5]\`, \`[6, 6]\`, and \`[12, 12]\`, respectively. The variable \`x\` of line 1 is mapped to the interval \`[42, 42]\` of the assigned value and the variable \`y\` of line 2 is assigned to the interval \`[6, 12]\` representing a sound over-approximation of the actual value, as the assigned value can be \`6\` or \`12\`. After applying the abstract semantics of the addition of \`x\` and \`y\`, the addition operation \`+\` and the variable \`z\` of line 3 are mapped to the interval \`[48, 54]\`, resulting from the addition of the interval \`[42, 42]\` of \`x\` and \`[6, 12]\` of \`y\`.

${section('Testing', 2, 'testing')}

_flowR_ provides a generic testing framework for abstract interpretation in ${linkFlowRSourceFile('test/functionality/abstract-interpretation/inference.ts')}. The framework supports two kinds of tests for testing inferred abstract domain values at given source code locations (as ${ctx.link('SlicingCriteria')}):

 1. **Assertion tests** — compare the inferred values against manually specified expected values (${ctx.link('assertInferredValues')}).
 2. **Validation tests** — run the code to output the actual value at each location and compare the inferred values against the actual values (${ctx.link('validateInferredValues')}).

The test function ${ctx.link('testInferredValues')} combines both tests: it performs an assertion test when an ${ctx.link('InferenceTestCase')} record of expected values is provided, and a validation test (unless the option \`skipRun\` is set). When only a list of slicing criteria is provided instead of a ${ctx.link('InferenceTestCase')}, only the validation test is performed. For the validation test, it is required that all slicing criteria represent symbols, as the instrumentation of the code adds print statements for each symbol location after the code line of the symbol. The function takes the following arguments:

 * \`name\` — the name or label of the test
 * \`shell\` — the R shell to use for the validation test
 * \`code\` — the R code to analyse and (for validation) to execute
 * \`expected\` — an ${ctx.link('InferenceTestCase')} mapping slicing criteria to expected abstract values, or a list of slicing criteria for validation-only tests
 * \`createAnalysis\` — a function creating the ${ctx.link('AbsintAnalysis')} to perform
 * \`domain\` — the name of the abstract domain of the analysis to compare the inferred values for
 * \`createOutputCode\` — a function \`(marker, symbol) => string\` that returns R code printing the analyzed properties of \`symbol\` in a line prefixed with \`marker\`
 * \`parseOutput\` — a function \`(line) => Domain | undefined\` that parses the output line produced by \`createOutputCode\` into an abstract domain value
 * \`options\` — optional inference test settings (_flowR_ configuration, additional project files, domain matching type, \`skipRun\`, etc.)

Additionally, ${ctx.link('assertInferredValues')} and ${ctx.link('validateInferredValues')} are available to only perform the assertions for assertion tests or validation tests without wrapping them into a test case.

When comparing inferred values with expected values, the framework supports two matching types via ${ctx.link('DomainMatchingType')}:

 * ${ctx.link('DomainMatchingType::Equal')} — the inferred value must equal the expected value (default for assertion tests)
 * ${ctx.link('DomainMatchingType::Overapproximation')} — the inferred value must be an over-approximation of the actual value via ${ctx.linkM(AbstractDomain, 'leq')} (default for validation tests)

For example, to use the test framework for the ${ctx.link('IntervalAnalysis')} defined above, we first define how to print the properties of an actual numeric scalar value in R using \`createOutputCode\` and how to parse it into an abstract domain value using \`parseOutput\`. Then, we can use ${ctx.link('testInferredValues')} to create a test for our code example by providing a test name, an R shell, the code to test, the test locations as slicing criteria with expected values, the analysis and the name of its abstract domain, and our \`createOutputCode\` and \`parseOutput\` function:

${ctx.codeFile('test/functionality/abstract-interpretation/wiki-absint.ts', { skipImports: true, hideDefinedAt: true })}

The assertion test verifies that the inferred intervals match the specified expected values exactly (using ${ctx.link('DomainMatchingType::Equal')}). The validation test instruments the code by inserting print statements after each tested location, executes the instrumented code with the R shell, and checks that each inferred interval at these locations is an over-approximation of the actual runtime value (using ${ctx.link('DomainMatchingType::Overapproximation')}). For example, the inferred interval \`[6, 12]\` for \`y\` is a sound over-approximation of the actual value \`6\` or \`12\`, depending on the random branch taken at runtime.

For an existing example of the test framework used in practice, see the data frame shape inference tests in ${linkFlowRSourceFile('test/functionality/abstract-interpretation/data-frame/inference.test.ts')}, which use a domain-specific wrapper ${ctx.link('testInferredDataFrameShape')} built on top of ${ctx.link('testInferredValues')}.
        `;
	}
}
