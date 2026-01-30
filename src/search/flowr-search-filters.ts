import { RType, ValidRTypes } from '../r-bridge/lang-4.x/ast/model/type';
import { ValidVertexTypes, VertexType } from '../dataflow/graph/vertex';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrSearchElement } from './flowr-search';
import type { CallTargetsContent } from './search-executor/search-enrichers';
import { Enrichment, enrichmentContent } from './search-executor/search-enrichers';
import type { BuiltInProcName } from '../dataflow/environments/built-in';
import type { DataflowInformation } from '../dataflow/info';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

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
	MatchesEnrichment = 'matches-enrichment',
	/**
	 * Only returns search elements whose {@link FunctionOriginInformation} match a given pattern or value.
	 * This filter accepts {@link OriginKindArgs}, which includes the {@link DataflowGraphVertexFunctionCall.origin} to match for, whether to match for every or some origins, and whether to include non-function-calls in the filtered query.
	 */
	OriginKind = 'origin-kind'
}
export type FlowrFilterFunction <T> = (e: FlowrSearchElement<ParentInformation>, args: T, data: {dataflow: DataflowInformation}) => boolean;

export const ValidFlowrFilters: Set<string> = new Set(Object.values(FlowrFilter));
export const ValidFlowrFiltersReverse = Object.fromEntries(Object.entries(FlowrFilter).map(([k, v]) => [v, k]));

export const FlowrFilters = {
	[FlowrFilter.DropEmptyArguments]: ((e: FlowrSearchElement<ParentInformation>, _args: never) => {
		return e.node.type !== RType.Argument || e.node.name !== undefined;
	}) satisfies FlowrFilterFunction<never>,
	[FlowrFilter.MatchesEnrichment]: ((e: FlowrSearchElement<ParentInformation>, args: MatchesEnrichmentArgs<Enrichment>) => {
		if(args.enrichment === Enrichment.CallTargets) {
			const c: CallTargetsContent = enrichmentContent(e, Enrichment.CallTargets);
			if(c === undefined || c.targets === undefined) {
				return false;
			}
			for(const fn of c.targets) {
				if(typeof fn === 'string' && args.test.test(fn)) {
					return true;
				}
				if(typeof fn === 'object' && 'node' in fn && fn.node.type === RType.FunctionCall && fn.node.named && args.test.test((fn.node.functionName as RSymbol).content)) {
					return true;
				}
			}
			return false;
		} else {
			const content = JSON.stringify(enrichmentContent(e, args.enrichment));
			return content !== undefined && args.test.test(content);
		}
	}) satisfies FlowrFilterFunction<MatchesEnrichmentArgs<Enrichment>>,
	[FlowrFilter.OriginKind]: ((e: FlowrSearchElement<ParentInformation>, args: OriginKindArgs, data: { dataflow: DataflowInformation }) => {
		const dfgNode = data.dataflow.graph.getVertex(e.node.info.id);
		if(!dfgNode || dfgNode.tag !== VertexType.FunctionCall) {
			return args.keepNonFunctionCalls ?? false;
		}
		const match = typeof args.origin === 'string' ?
			(origin: string) => args.origin === origin :
			(origin: string) => (args.origin as RegExp).test(origin);
		const origins = Array.isArray(dfgNode.origin) ? dfgNode.origin : [dfgNode.origin];
		return args.matchType === 'every' ? origins.every(match) : origins.some(match);
	}) satisfies FlowrFilterFunction<OriginKindArgs>
} as const;
export type FlowrFilterArgs<F extends FlowrFilter> = typeof FlowrFilters[F] extends FlowrFilterFunction<infer Args> ? Args : never;

export interface MatchesEnrichmentArgs<E extends Enrichment> {
	enrichment: E,
	test:       RegExp
}
export interface OriginKindArgs {
	origin:                BuiltInProcName | RegExp;
	matchType?:            'some' | 'every';
	keepNonFunctionCalls?: boolean
}

/**
 * Helper to create a regular expression that matches function names, ignoring their package.
 */
export function testFunctionsIgnoringPackage(functions: readonly string[]): RegExp {
	return new RegExp(`^(.+:::?)?(${functions.join('|')})$`);
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

/**
 * Converts the given binary tree to a string representation.
 */
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

/**
 * Checks whether the given value is a binary tree combinator.
 * @see {@link FlowrFilterCombinator}
 */
export function isBinaryTree(tree: unknown): tree is { tree: BooleanNode } {
	return typeof tree === 'object' && tree !== null && 'tree' in tree;
}

interface FilterData {
	readonly element: FlowrSearchElement<ParentInformation>,
	readonly data:    { dataflow: DataflowInformation }
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
	'vertex-type': ({ value }: LeafVertexType, { data, element }: FilterData) =>
		data.dataflow.graph.getVertex(element.node.info.id)?.tag === value,
	'special': ({ value }: LeafSpecial, { data, element }: FilterData) => {
		const name = typeof value === 'string' ? value : value.name;
		const args = typeof value === 'string' ? undefined as unknown as FlowrFilterArgs<FlowrFilter> : value.args;
		const getHandler = FlowrFilters[name];
		if(getHandler) {
			return getHandler(element, args, data);
		}
		throw new Error(`Couldn't find special filter with name ${name}`);
	}
};

function evalTree(tree: BooleanNode, data: FilterData): boolean {
	/* we ensure that the types fit */
	return evalVisit[tree.type](tree as never, data);
}

/**
 * Evaluates the given filter expression against the provided data.
 */
export function evalFilter<Filter extends FlowrFilter>(filter: FlowrFilterExpression<Filter>, data: FilterData): boolean {
	/* common lift, this can be improved easily :D */
	const tree = FlowrFilterCombinator.is(filter as FlowrFilterExpression);
	return evalTree(tree.get(), data);
}
