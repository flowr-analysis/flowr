

import type { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { VertexType } from '../dataflow/graph/vertex';

export type FlowrFilterName = keyof typeof FlowrFilters;

export enum FlowrFilter {

}

export const FlowrFilters = {

} as const;


type ValidFilterTypes = FlowrFilterName | RType | VertexType;
/**
 * By default, we provide filter for every {@link RType} and {@link VertexType}.
 */
export type FlowrFilterExpression = FlowrFilterCombinator | ValidFilterTypes;

interface BooleanBinaryNode<Composite> {
	readonly type:  'and' | 'or' | 'xor';
	readonly left:  Composite;
	readonly right: Composite;
}
interface BooleanUnaryNode<Composite> {
	readonly type:    'not';
	readonly operand: Composite;
}

type Leaf = ValidFilterTypes;

type BooleanNode = BooleanBinaryNode<BooleanNode>
	| BooleanUnaryNode<BooleanNode>
	| Leaf;


type BooleanNodeOrCombinator = BooleanNode | FlowrFilterCombinator

export class FlowrFilterCombinator {
	private tree: BooleanNode;

	protected constructor(init: BooleanNodeOrCombinator) {
		this.tree = this.unpack(init);
	}

	public static is(value: BooleanNodeOrCombinator): FlowrFilterCombinator {
		return new this(value);
	}

	public and(right: BooleanNodeOrCombinator): this {
		this.tree = {
			type:  'and',
			left:  this.tree,
			right: this.unpack(right)
		};
		return this;
	}

	public or(right: BooleanNodeOrCombinator): this {
		this.tree = {
			type:  'or',
			left:  this.tree,
			right: this.unpack(right)
		};
		return this;
	}

	public xor(right: BooleanNodeOrCombinator): this {
		this.tree = {
			type:  'xor',
			left:  this.tree,
			right: this.unpack(right)
		};
		return this;
	}

	public not(): this {
		this.tree = {
			type:    'not',
			operand: this.tree
		};
		return this;
	}

	private unpack(val: BooleanNodeOrCombinator): BooleanNode {
		return val instanceof FlowrFilterCombinator ? val.tree : val;
	}
}
