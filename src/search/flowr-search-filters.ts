import { RType , ValidRTypes } from '../r-bridge/lang-4.x/ast/model/type';
import type { VertexType } from '../dataflow/graph/vertex';
import { ValidVertexTypes } from '../dataflow/graph/vertex';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';

export type FlowrFilterName = keyof typeof FlowrFilters;

export enum FlowrFilter {
	DropEmptyArguments = 'drop-empty-arguments'
}

export const ValidFlowrFilters: Set<string> = new Set(Object.values(FlowrFilter));

export const FlowrFilters = {
	[FlowrFilter.DropEmptyArguments]: (n: RNode<ParentInformation>) => {
		return n.type !== RType.Argument || n.name !== undefined;
	}
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

type LeafRType = { readonly type: 'r-type', readonly value: RType };
type LeafVertexType = { readonly type: 'vertex-type', readonly value: VertexType };
type LeafSpecial = { readonly type: 'special', readonly value: string };

type Leaf = LeafRType | LeafVertexType | LeafSpecial;


type BooleanNode = BooleanBinaryNode<BooleanNode>
	| BooleanUnaryNode<BooleanNode>
	| Leaf;


type BooleanNodeOrCombinator = BooleanNode | FlowrFilterCombinator

/**
 * @see {@link FlowrFilterCombinator.is}
 * @see {@link evalFilter}
 * @see {@link binaryTreeToString}
 */
export class FlowrFilterCombinator {
	private tree: BooleanNode;

	protected constructor(init: BooleanNodeOrCombinator) {
		this.tree = this.unpack(init);
	}

	public static is(value: BooleanNodeOrCombinator | ValidFilterTypes): FlowrFilterCombinator {
		if(typeof value === 'object') {
			return new this(value);
		} else if(ValidRTypes.has(value as RType)) {
			return new this({ type: 'r-type', value: value as RType });
		} else if(ValidVertexTypes.has(value as VertexType)) {
			return new this({ type: 'vertex-type', value: value as VertexType });
		} else if(ValidFlowrFilters.has(value)) {
			return new this({ type: 'special', value: value as FlowrFilter });
		} else {
			throw new Error(`Invalid filter value: ${value}`);
		}
	}

	public and(right: BooleanNodeOrCombinator | ValidFilterTypes): this {
		return this.binaryRight('and', right);
	}

	public or(right: BooleanNodeOrCombinator | ValidFilterTypes): this {
		return this.binaryRight('or', right);
	}

	public xor(right: BooleanNodeOrCombinator | ValidFilterTypes): this {
		return this.binaryRight('xor', right);
	}

	private binaryRight(op: BooleanBinaryNode<BooleanNode>['type'], right: BooleanNodeOrCombinator | ValidFilterTypes): this {
		this.tree = {
			type:  op,
			left:  this.tree,
			right: this.unpack(FlowrFilterCombinator.is(right))
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

	public get(): BooleanNode {
		return this.tree;
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
	if(tree.type === 'r-type' || tree.type === 'vertex-type' || tree.type === 'special') {
		return tree.value;
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

interface FilterData {
	readonly node:      RNode<ParentInformation>,
	readonly normalize: NormalizedAst,
	readonly dataflow:  DataflowInformation
}

const evalVisit = {
	and: ({ left, right }: BooleanBinaryNode<BooleanNode>, data: FilterData) =>
		evalTree(left, data) && evalTree(right, data),
	or: ({ left, right }: BooleanBinaryNode<BooleanNode>, data: FilterData) =>
		evalTree(left, data) || evalTree(right, data),
	xor: ({ left, right }: BooleanBinaryNode<BooleanNode>, data: FilterData) =>
		evalTree(left, data) !== evalTree(right, data),
	not: ({ operand }: BooleanUnaryNode<BooleanNode>, data: FilterData) =>
		!evalTree(operand, data),
	'r-type': ({ value }: LeafRType, { node }: FilterData) =>
		node.type === value,
	'vertex-type': ({ value }: LeafVertexType, { dataflow: { graph }, node }: FilterData) =>
		graph.getVertex(node.info.id)?.tag === value,
	'special': ({ value }: LeafSpecial, { node }: FilterData) => {
		const getHandler = FlowrFilters[value as FlowrFilterName];
		if(getHandler) {
			return getHandler(node);
		}
		throw new Error(`Special filter not implemented: ${value}`);
	}
};

function evalTree(tree: BooleanNode, data: FilterData): boolean {
	/* we ensure that the types fit */
	return evalVisit[tree.type](tree as never, data);
}

export function evalFilter(filter: FlowrFilterExpression, data: FilterData): boolean {
	/* common lift, this can be improved easily :D */
	const tree = FlowrFilterCombinator.is(filter);
	return evalTree(tree.get(), data);
}
