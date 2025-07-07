import { RType , ValidRTypes } from '../r-bridge/lang-4.x/ast/model/type';
import type { VertexType } from '../dataflow/graph/vertex';
import { ValidVertexTypes } from '../dataflow/graph/vertex';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { FlowrSearchElement } from './flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { Enrichment } from './search-executor/search-enrichers';
import { enrichmentContent } from './search-executor/search-enrichers';

export type FlowrFilterName = keyof typeof FlowrFilters;
interface FlowrFilterWithArgs<Filter extends FlowrFilterName, Args extends FlowrFilterArgs<Filter>> {
	name: Filter;
	args: Args
}

export enum FlowrFilter {
	/**
	 * Drops search elements that represent empty arguments. Specifically, all nodes that are arguments and have an undefined name are skipped.
	 * This filter does not accept any arguments.
	 */
	DropEmptyArguments = 'drop-empty-arguments',
	/**
	 * Only returns search elements whose enrichments' JSON representations match a given test regular expression.
	 * This filter accepts {@link MatchesEnrichmentArgs}, which includes the enrichment to match for, as well as the regular expression to test the enrichment's (non-pretty-printed) JSON representation for.
	 * To test for included function names in an enrichment like {@link Enrichment.CallTargets}, the helper function {@link testFunctionsIgnoringPackage} can be used.
	 */
	MatchesEnrichment = 'matches-enrichment'
}
export type FlowrFilterFunction <T extends MergeableRecord> = (e: FlowrSearchElement<ParentInformation>, args: T) => boolean;

export const ValidFlowrFilters: Set<string> = new Set(Object.values(FlowrFilter));
export const ValidFlowrFiltersReverse = Object.fromEntries(Object.entries(FlowrFilter).map(([k, v]) => [v, k]));

export const FlowrFilters = {
	[FlowrFilter.DropEmptyArguments]: ((e: FlowrSearchElement<ParentInformation>, _args: never) => {
		return e.node.type !== RType.Argument || e.node.name !== undefined;
	}) satisfies FlowrFilterFunction<never>,
	[FlowrFilter.MatchesEnrichment]: ((e: FlowrSearchElement<ParentInformation>, args: MatchesEnrichmentArgs<Enrichment>) => {
		const content = JSON.stringify(enrichmentContent(e, args.enrichment));
		return content !== undefined && args.test.test(content);
	}) satisfies FlowrFilterFunction<MatchesEnrichmentArgs<Enrichment>>
} as const;
export type FlowrFilterArgs<F extends FlowrFilter> = typeof FlowrFilters[F] extends FlowrFilterFunction<infer Args> ? Args : never;

export interface MatchesEnrichmentArgs<E extends Enrichment> extends MergeableRecord {
	enrichment: E,
	test:       RegExp
}

export function testFunctionsIgnoringPackage(functions: string[]): RegExp {
	return new RegExp(`"(.+:::?)?(${functions.join('|')})"`);
}

type ValidFilterTypes<F extends FlowrFilter = FlowrFilter> = FlowrFilterName | FlowrFilterWithArgs<F, FlowrFilterArgs<F>> | RType | VertexType;
/**
 * By default, we provide filter for every {@link RType} and {@link VertexType}.
 */
export type FlowrFilterExpression<F extends FlowrFilter = FlowrFilter> = FlowrFilterCombinator | ValidFilterTypes<F>;

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
type LeafSpecial = { readonly type: 'special', readonly value: FlowrFilterName | FlowrFilterWithArgs<FlowrFilter, FlowrFilterArgs<FlowrFilter>> };

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
		if(typeof value === 'string' && ValidFlowrFilters.has(value)) {
			return new this({ type: 'special', value: value as FlowrFilter });
		} else if(typeof value === 'object') {
			const name = (value as FlowrFilterWithArgs<FlowrFilter, FlowrFilterArgs<FlowrFilter>>)?.name;
			if(name && ValidFlowrFilters.has(name)) {
				return new this({ type: 'special', value: value as FlowrFilterWithArgs<FlowrFilter, FlowrFilterArgs<FlowrFilter>> });
			} else {
				return new this(value as BooleanNodeOrCombinator);
			}
		} else if(ValidRTypes.has(value as RType)) {
			return new this({ type: 'r-type', value: value as RType });
		} else if(ValidVertexTypes.has(value as VertexType)) {
			return new this({ type: 'vertex-type', value: value as VertexType });
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
		return typeof tree.value === 'string' ? tree.value : `${tree.value.name}@${JSON.stringify(tree.value.args)}`;
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
	readonly element:   FlowrSearchElement<ParentInformation>,
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
	'r-type': ({ value }: LeafRType, { element }: FilterData) =>
		element.node.type === value,
	'vertex-type': ({ value }: LeafVertexType, { dataflow: { graph }, element }: FilterData) =>
		graph.getVertex(element.node.info.id)?.tag === value,
	'special': ({ value }: LeafSpecial, { element }: FilterData) => {
		const name = typeof value === 'string' ? value : value.name;
		const args = typeof value === 'string' ? undefined as unknown as FlowrFilterArgs<FlowrFilter> : value.args;
		const getHandler = FlowrFilters[name];
		if(getHandler) {
			return getHandler(element, args);
		}
		throw new Error(`Couldn't find special filter with name ${name}`);
	}
};

function evalTree(tree: BooleanNode, data: FilterData): boolean {
	/* we ensure that the types fit */
	return evalVisit[tree.type](tree as never, data);
}

export function evalFilter<Filter extends FlowrFilter>(filter: FlowrFilterExpression<Filter>, data: FilterData): boolean {
	/* common lift, this can be improved easily :D */
	const tree = FlowrFilterCombinator.is(filter as FlowrFilterExpression);
	return evalTree(tree.get(), data);
}
