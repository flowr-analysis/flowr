import { assert, describe, test } from 'vitest';
import type { AbsintPredecessor, AbsintVisitorConfiguration } from '../../../src/abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../../../src/abstract-interpretation/absint-visitor';
import { IntervalDomain } from '../../../src/abstract-interpretation/domains/interval-domain';
import { StateAbstractDomain } from '../../../src/abstract-interpretation/domains/state-abstract-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../../src/dataflow/graph/vertex';
import type { RNumber } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { guard } from '../../../src/util/assert';
import { runInference } from './inference';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { FunctionArgument } from '../../../src/dataflow/graph/graph';
import type { OnCall } from '../../../src/control-flow/semantic-cfg-guided-visitor';
import { VertexType } from '../../../src/dataflow/graph/vertex';

/** Records every branch the visitor is handed and, if asked to, refines the condition with what the branch says. */
class BranchAwareVisitor extends AbstractInterpretationVisitor<StateAbstractDomain<IntervalDomain>> {
	public readonly branches = new Set<string>();

	constructor(config: AbsintVisitorConfiguration, private readonly refineCondition = false) {
		super(config, StateAbstractDomain.top(IntervalDomain.top()));
	}

	public decidedBy(id: NodeId): readonly NodeId[] {
		return this.getDecidedConstructs(id);
	}

	public stateAt(id: NodeId): StateAbstractDomain<IntervalDomain> | undefined {
		return this.getAbstractState(id);
	}

	protected override getPredecessorState(pred: AbsintPredecessor): StateAbstractDomain<IntervalDomain> | undefined {
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
		refined.set(pred.id, new IntervalDomain(pred.branch.when ? [1, 1] : [0, 0]));
		return refined;
	}

	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue, node: RNumber<ParentInformation> }): void {
		super.onNumberConstant({ vertex, node });
		this.currentState.set(node.info.id, new IntervalDomain([node.content.num, node.content.num]));
	}
}

/** Follows every call that has a definition to step into. */
class CallFollowingVisitor extends AbstractInterpretationVisitor<StateAbstractDomain<IntervalDomain>> {
	constructor(config: AbsintVisitorConfiguration) {
		super(config, StateAbstractDomain.top(IntervalDomain.top()));
	}

	public stateAt(id: NodeId): StateAbstractDomain<IntervalDomain> | undefined {
		return this.getAbstractState(id);
	}

	protected override shouldEnterCall(call: DataflowGraphVertexFunctionCall): boolean {
		return this.getCallTargets(call.id).length > 0;
	}

	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue, node: RNumber<ParentInformation> }): void {
		super.onNumberConstant({ vertex, node });
		this.currentState.set(node.info.id, new IntervalDomain([node.content.num, node.content.num]));
	}

	protected override onFunctionCall({ call }: OnCall): void {
		super.onFunctionCall({ call });

		if(call.args.length === 2 && call.args.every(FunctionArgument.isNotEmpty) && Identifier.getName(call.name) === '+') {
			const left = this.getAbstractValue(call.args[0].nodeId, this.currentState);
			const right = this.getAbstractValue(call.args[1].nodeId, this.currentState);
			if(left !== undefined && right !== undefined) {
				this.currentState.set(call.id, left.add(right));
			}
		}
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
		const visitor = await runInference(code, config => new BranchAwareVisitor(config));
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
		const visitor = await runInference(code, config => new BranchAwareVisitor(config, true));
		const condition = idOf(visitor, lexeme => lexeme === 'u');
		const then = idOf(visitor, lexeme => lexeme === '3');
		const otherwise = idOf(visitor, lexeme => lexeme === '2');

		assert.isTrue(visitor.stateAt(then)?.get(condition)?.equals(new IntervalDomain([1, 1])), 'u holds in the then-branch');
		assert.isTrue(visitor.stateAt(otherwise)?.get(condition)?.equals(new IntervalDomain([0, 0])), 'u does not hold in the else-branch');
	});
});

describe('Abstract Interpretation Visitor (interprocedural)', () => {
	/** The value inferred for each variable at the end of the program */
	async function valuesOf(code: string): Promise<Map<string, string | undefined>> {
		const visitor = await runInference(code, config => new CallFollowingVisitor(config));
		const end = visitor.getEndState();
		const values = new Map<string, string | undefined>();

		for(const [id] of visitor.config.dfg.verticesOfType(VertexType.VariableDefinition)) {
			const name = visitor.config.normalizedAst.idMap.get(id)?.lexeme;
			if(name !== undefined) {
				values.set(name, end.isValue() ? end.value.get(id)?.toString() : undefined);
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
		assert.strictEqual(values.get('x'), '[0, +\u221e]');
	});

	test('a recursive call is not followed a second time', async() => {
		const values = await valuesOf('f <- function() f()\nx <- f()');
		assert.strictEqual(values.get('x'), undefined);
	});
});
