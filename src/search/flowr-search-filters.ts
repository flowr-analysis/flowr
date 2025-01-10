

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
		return this.binaryRight('and', right);
	}

	public or(right: BooleanNodeOrCombinator): this {
		return this.binaryRight('or', right);
	}

	public xor(right: BooleanNodeOrCombinator): this {
		return this.binaryRight('xor', right);
	}

	private binaryRight(op: BooleanBinaryNode<BooleanNode>['type'], right: BooleanNodeOrCombinator): this {
		this.tree = {
			type:  op,
			left:  this.tree,
			right: this.unpack(right)
		};
		return this;
	}

	public not(): this {
		return this.unary('not');
	}

	private unary(op: BooleanUnaryNode<BooleanNode>['type']): this {
		this.tree = {
			type:    op,
			operand: this.tree
		};
		return this;
	}

	private unpack(val: BooleanNodeOrCombinator): BooleanNode {
		return val instanceof FlowrFilterCombinator ? val.tree : val;
	}
}

export function binaryTreeToString(tree: BooleanNode): string {
	const res = treeToStringImpl(tree, 0);
	// drop outer parens
	if(res.startsWith('(') && res.endsWith(')')) {
		return res.slice(1, -1);
	} else {
		return res;
	}
}

const typeToSymbol: Record<BooleanBinaryNode<BooleanNode>['type'] | BooleanUnaryNode<BooleanNode>['type'], string> = {
	'and': '∧',
	'or':  '∨',
	'xor': '⊕',
	'not': '¬'
};

function treeToStringImpl(tree: BooleanNode, depth: number): string {
	if(typeof tree === 'string') {
		return tree;
	}
	if(tree.type === 'not') {
		return `${typeToSymbol[tree.type]}${treeToStringImpl(tree.operand, depth)}`;
	}
	const left  = treeToStringImpl(tree.left,  depth + 1);
	const right = treeToStringImpl(tree.right, depth + 1);
	return `(${left} ${typeToSymbol[tree.type]} ${right})`;
}


export function isBinaryTree(tree: unknown): tree is { tree: BooleanNode } {
	return typeof tree === 'object' && tree !== null && 'tree' in tree;
}
