import { assert, describe, test } from 'vitest';
import type { AbsintAnalysis, AbsintPredecessor, AbsintVisitorConfiguration } from '../../../src/abstract-interpretation/absint-inference';
import { AbstractInterpreter } from '../../../src/abstract-interpretation/absint-inference';
import { IntervalDomain } from '../../../src/abstract-interpretation/domains/interval-domain';
import type { MultiValueStateDomain } from '../../../src/abstract-interpretation/domains/multi-value-state-domain';
import type { StateDomain } from '../../../src/abstract-interpretation/domains/state-domain';
import { ValueSemantics } from '../../../src/abstract-interpretation/value-semantics';
import type { DataflowGraphVertexFunctionCall } from '../../../src/dataflow/graph/vertex';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { guard } from '../../../src/util/assert';
import { runInterpreter } from './inference';
import { FlowrConfig } from '../../../src/config';
import { FunctionArgument } from '../../../src/dataflow/graph/graph';
import type { OnCall } from '../../../src/control-flow/semantic-cfg-guided-visitor';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { VertexType } from '../../../src/dataflow/graph/vertex';

/** The single abstract domain of the analyses below, i.e. an interval per AST node */
type IntervalDomains = { interval: IntervalDomain };

/** Number constants are worth themselves, and `+` is worth the sum of what its operands are worth */
const IntervalSemantics = new ValueSemantics<StateDomain<IntervalDomain>>({
	constants: {
		number: (state, vertex, _ctx, value) => state.set(vertex.id, IntervalDomain.from(value.num))
	},
	functionCalls: {
		'base::+': (state, vertex, ctx) => {
			if(vertex.args.length !== 2 || !vertex.args.every(FunctionArgument.isNotEmpty)) {
				return;
			}
			const left = ctx.getAbstractValue(vertex.args[0].nodeId, state);
			const right = ctx.getAbstractValue(vertex.args[1].nodeId, state);

			if(left !== undefined && right !== undefined) {
				state.set(vertex.id, left.add(right));
			}
		}
	}
});

const IntervalAnalysis: AbsintAnalysis<IntervalDomains> = {
	domains:   { interval: IntervalDomain.top() },
	semantics: { interval: IntervalSemantics }
};

/** Records every branch the interpreter is handed and, if asked to, refines the condition with what the branch says. */
class BranchAwareVisitor extends AbstractInterpreter<IntervalDomains> {
	public readonly branches = new Set<string>();

	constructor(config: AbsintVisitorConfiguration, private readonly refineCondition = false) {
		super(config, IntervalAnalysis);
	}

	public decidedBy(id: NodeId): readonly NodeId[] {
		return this.getDecidedConstructs(id);
	}

	public stateAt(id: NodeId): StateDomain<IntervalDomain> | undefined {
		return this.getAbstractState(id, 'interval');
	}

	protected override getPredecessorState(pred: AbsintPredecessor): MultiValueStateDomain<Partial<IntervalDomains>> | undefined {
		const state = super.getPredecessorState(pred);
		if(pred.branch === undefined) {
			return state;
		}
		this.branches.add(`${pred.id} -> ${pred.branch.id} is ${pred.branch.when}`);

		if(!this.refineCondition || !state?.isValue()) {
			return state;
		}
		/* the predecessor is the condition and the branch says how it came out, so we can pin it down here */
		const refined = state.create(state.value);
		refined.setValue(pred.id, 'interval', new IntervalDomain(pred.branch.when ? [1, 1] : [0, 0]));
		return refined;
	}
}

/** The configuration of an analysis that is not interprocedural unless it says so itself. */
const Intraprocedural = FlowrConfig.amend(FlowrConfig.default(), c => {
	c.abstractInterpretation.followCalls = false;
});

/** Steps into every call with a definition, which is what the configuration asks for by default. */
class CallFollowingVisitor extends AbstractInterpreter<IntervalDomains> {
	constructor(config: AbsintVisitorConfiguration, private readonly alwaysEnter = false) {
		super(config, IntervalAnalysis);
	}

	protected override shouldEnterCall(call: DataflowGraphVertexFunctionCall): boolean {
		return this.alwaysEnter || super.shouldEnterCall(call);
	}

	public stateAt(id: NodeId): StateDomain<IntervalDomain> | undefined {
		return this.getAbstractState(id, 'interval');
	}
}

/** Records every call the analysis is handed, whether or not the traversal steps into it. */
class CallCountingVisitor extends AbstractInterpreter<IntervalDomains> {
	public readonly calls: string[] = [];

	constructor(config: AbsintVisitorConfiguration) {
		super(config, IntervalAnalysis);
	}

	protected override onFunctionCall({ call }: OnCall): void {
		super.onFunctionCall({ call });
		this.calls.push(Identifier.getName(call.name) ?? '?');
	}
}

describe('Abstract Interpretation Visitor', () => {
	const code = 'if(u) 3 else 2';

	function idOf(visitor: BranchAwareVisitor | CallFollowingVisitor, predicate: (lexeme: string | undefined, type: RType) => boolean): NodeId {
		for(const [id, node] of visitor.config.normalizedAst.idMap) {
			if(predicate(node.lexeme, node.type)) {
				return id;
			}
		}
		guard(false, () => `no node matching in ${code}`);
	}

	test('the condition names the if it decides', async() => {
		const visitor = await runInterpreter(code, config => new BranchAwareVisitor(config));
		const ifNode = idOf(visitor, (_, type) => type === RType.IfThenElse);
		const condition = idOf(visitor, lexeme => lexeme === 'u');

		assert.deepStrictEqual(visitor.decidedBy(condition), [ifNode]);
		assert.deepStrictEqual(visitor.decidedBy(ifNode), []);
		assert.deepStrictEqual([...visitor.branches].sort(), [
			`${condition} -> ${ifNode} is false`,
			`${condition} -> ${ifNode} is true`
		]);
	});

	test('a branch may refine the condition it came from', async() => {
		const visitor = await runInterpreter(code, config => new BranchAwareVisitor(config, true));
		const condition = idOf(visitor, lexeme => lexeme === 'u');
		const then = idOf(visitor, lexeme => lexeme === '3');
		const otherwise = idOf(visitor, lexeme => lexeme === '2');

		assert.isTrue(visitor.stateAt(then)?.get(condition)?.equals(new IntervalDomain([1, 1])), 'u holds in the then-branch');
		assert.isTrue(visitor.stateAt(otherwise)?.get(condition)?.equals(new IntervalDomain([0, 0])), 'u does not hold in the else-branch');
	});
});

describe('Abstract Interpretation Visitor (interprocedural)', () => {
	/** The value inferred for each variable at the end of the program */
	async function valuesOf(code: string, config?: FlowrConfig): Promise<Map<string, string | undefined>> {
		const visitor = await runInterpreter(code, c => new CallFollowingVisitor(c), { config });
		const end = visitor.getEndState();
		const values = new Map<string, string | undefined>();

		for(const [id] of visitor.config.dfg.verticesOfType(VertexType.VariableDefinition)) {
			const name = visitor.config.normalizedAst.idMap.get(id)?.lexeme;
			if(name !== undefined) {
				values.set(name, end.isValue() ? end.getValue(id, 'interval')?.toString() : undefined);
			}
		}
		return values;
	}

	test('a call is worth what the function it calls leaves behind', async() => {
		const values = await valuesOf('f <- function() 3\nx <- f()');
		assert.strictEqual(values.get('x'), '[3, 3]');
	});

	test('every call site passes its own arguments', async() => {
		const values = await valuesOf('f <- function(a) a + 1\ny <- f(1)\nz <- f(10)');
		assert.strictEqual(values.get('y'), '[2, 2]');
		assert.strictEqual(values.get('z'), '[11, 11]');
	});

	test('a loop in a called function still widens', async() => {
		const values = await valuesOf('f <- function(n) { s <- 0\nwhile(n) { s <- s + 1 }\ns }\nx <- f(3)');
		/* the loop runs any number of times, so the result is bounded from below only */
		assert.strictEqual(values.get('x'), '[0, +∞]');
	});

	test('a recursive call is not followed a second time', async() => {
		const values = await valuesOf('f <- function() f()\nx <- f()');
		assert.strictEqual(values.get('x'), undefined);
	});

	test('every definition a call may reach contributes', async() => {
		const values = await valuesOf('if(u) { f <- function() 3 } else { f <- function() 8 }\nx <- f()');
		assert.strictEqual(values.get('x'), '[3, 8]', 'the call is worth what either definition leaves');
	});

	test('the analysis is interprocedural unless the configuration says otherwise', () => {
		assert.isTrue(FlowrConfig.default().abstractInterpretation.followCalls);
		assert.isFalse(Intraprocedural.abstractInterpretation.followCalls);
	});

	test.each([
		['a call is worth what its function returns', 'f <- function() 3\nx <- f()'],
		['a call site hands over its own arguments', 'f <- function(a) a\nx <- f(3)'],
		['a call within a called function',          'g <- function(a) a\nf <- function(a) g(a)\nx <- f(3)'],
		['every definition a call may reach',        'if(u) { f <- function() 3 } else { f <- function() 3 }\nx <- f()'],
		['a recursion that settles',                 'f <- function(n) if(n <= 0) 3 else f(n - 1)\nx <- f(2)']
	])('%s, and nothing at all when the configuration does not follow it', async(_name, code) => {
		assert.isDefined(await valuesOf(code).then(v => v.get('x')), 'the call is followed by default');
		assert.strictEqual((await valuesOf(code, Intraprocedural)).get('x'), undefined,
			'and is not followed when `followCalls` is off');
	});

	test('an analysis may still follow calls the configuration does not', async() => {
		const visitor = await runInterpreter('f <- function() 3\nx <- f()',
			config => new CallFollowingVisitor(config, true), { config: Intraprocedural });
		const end = visitor.getEndState();
		const definition = [...visitor.config.dfg.verticesOfType(VertexType.VariableDefinition)]
			.find(([id]) => visitor.config.normalizedAst.idMap.get(id)?.lexeme === 'x');

		assert.isDefined(definition);
		assert.strictEqual(end.isValue() ? end.getValue(definition[0], 'interval')?.toString() : undefined, '[3, 3]',
			'what the analysis decides wins over what the configuration defaults to');
	});

	test('an analysis is handed the calls it does not step into', async() => {
		const visitor = await runInterpreter('f <- function() 3\nx <- f()',
			config => new CallCountingVisitor(config), { config: Intraprocedural });

		assert.deepStrictEqual(visitor.calls, ['f'], 'a call that is not entered is still described by the analysis');
	});
});

describe('Abstract Interpretation Visitor (join vertices)', () => {
	/** A loop whose body is an `if`/`else if` chain of the given arms, with a value known before it. */
	function loopWithArms(arms: number): string {
		const chain = Array.from({ length: arms }, (_, i) => `${i === 0 ? 'if' : 'else if'}(i > ${i}) { y <- ${i + 20} }`).join(' ');
		return `x <- 7\nfor(i in 1:3) { ${chain} }\nz <- x`;
	}

	function idWithLexeme(visitor: BranchAwareVisitor, lexeme: string): NodeId {
		for(const [id, node] of visitor.config.normalizedAst.idMap) {
			if(node.lexeme === lexeme) {
				return id;
			}
		}
		guard(false, () => `no node with lexeme ${lexeme}`);
	}

	test.each([
		['while',  'while(u) { x <- 5 }'],
		['for',    'for(i in 1:3) { x <- 5 }'],
		['repeat', 'repeat { x <- 5\nif(u) break }']
	])('a loop head still says what it says (%s)', async(_name, code) => {
		const visitor = await runInterpreter(code, config => new BranchAwareVisitor(config));
		const state = visitor.stateAt(visitor.config.controlFlow.exitPoints[0]);

		assert.isTrue(state?.get(idWithLexeme(visitor, '5'))?.equals(new IntervalDomain([5, 5])),
			'the loop body is read even where the control flow comes back around');
	});

	test.each([1, 2, 3, 4])('a chain of %i arms within a loop keeps what its arms inferred', async(arms) => {
		const visitor = await runInterpreter(loopWithArms(arms), config => new BranchAwareVisitor(config));
		const state = visitor.stateAt(visitor.config.controlFlow.exitPoints[0]);
		assert.isDefined(state, 'the code after the loop is reached');

		assert.isTrue(state?.get(idWithLexeme(visitor, '7'))?.equals(new IntervalDomain([7, 7])),
			'what was known before the loop still is');
		for(let arm = 0; arm < arms; arm++) {
			const assigned = String(arm + 20);
			assert.isTrue(state?.get(idWithLexeme(visitor, assigned))?.equals(new IntervalDomain([arm + 20, arm + 20])),
				`what arm ${arm} assigned is still known after the loop`);
		}
	});
});
