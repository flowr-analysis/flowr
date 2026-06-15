import { RType, ValidRTypes } from '../r-bridge/lang-4.x/ast/model/type';
import { ValidVertexTypes, VertexType } from '../dataflow/graph/vertex';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrSearchElement } from './flowr-search';
import type { Enrichment } from './search-executor/search-enrichers';
import { enrichmentContent, EnrichmentElementContent } from './search-executor/search-enrichers';
import type { DataflowInformation } from '../dataflow/info';
import type { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { expensiveTrace } from '../util/log';
import { searchLogger } from './search-executor/search-generators';
import type { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';

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
	OriginKind = 'origin-kind',
	/**
	 * Only returns search element whose {@link RoleInParent} matches a given {@link RoleInParent}.
	 * This filter accepts an object containing a `roleInParent` argument of type {@link RoleInParent}.
	 */
	RoleInParent = 'role-in-parent',
	/**
	 * Only returns search elements whose file path matches the given regular expression.
	 * This filter accepts {@link FilePathFilterArgs}, which includes the file path regex to test against.
	 */
	FilePathFilter = 'file-path-filter'
}
export type FlowrFilterFunction <T> = (e: FlowrSearchElement<ParentInformation>, args: T, data: { dataflow: DataflowInformation }) => boolean;

export const ValidFlowrFilters: Set<string> = new Set(Object.values(FlowrFilter));
export const ValidFlowrFiltersReverse = Object.fromEntries(Object.entries(FlowrFilter).map(([k, v]) => [v, k]));

export const FlowrFilters = {
	[FlowrFilter.DropEmptyArguments]: ((e: FlowrSearchElement<ParentInformation>, _args: never) => {
		return e.node.type !== RType.Argument || e.node.name !== undefined;
	}) satisfies FlowrFilterFunction<never>,
	[FlowrFilter.MatchesEnrichment]: ((e: FlowrSearchElement<ParentInformation>, args: MatchesEnrichmentArgs<Enrichment>) => {
		const content = enrichmentContent(e, args.enrichment);
		return content && testRecursive(content, args.test);

		function testRecursive(realChild: Record<string, unknown>, expectedChild: Record<string, unknown>): boolean {
			expensiveTrace(searchLogger, () => `Comparing ${JSON.stringify(realChild)} against ${JSON.stringify(expectedChild)}`);

			for(const [expectedKey, expectedValue] of Object.entries(expectedChild)) {
				const realValue = realChild[expectedKey];
				if(!realValue) {
					expensiveTrace(searchLogger, () => `Real value ${JSON.stringify(realValue)} does not exist for expected key ${expectedKey}`);
					return false;
				}

				if(Array.isArray(realValue)) {
					const match = typeof expectedValue === 'object' ? expectedValue instanceof RegExp ?
						// if we expect a regular expression but an array is supplied, test each value
						(value: unknown) => expectedValue.test(typeof value === 'string' ? value : String(value)) :
						// if we expect an object that is not a regular expression, match against our expected structure
						(value: unknown) => testRecursive(value as Record<string, unknown>, expectedValue as Record<string, unknown>) :
						// in any other case (primitives!), match against the exact value
						(value: unknown) => expectedValue === value;
					if(!(args.arrayMatch === 'every' ? realValue.every(match) : realValue.some(match))) {
						expensiveTrace(searchLogger, () => `Array ${JSON.stringify(realValue)} does not match expected value ${JSON.stringify(expectedValue)} (array match ${args.arrayMatch})`);
						return false;
					}
				} else if(typeof realValue === 'object') {
					// for objects, we recursively match
					if(!testRecursive(realValue as Record<string, unknown>, expectedValue as Record<string, unknown>)) {
						expensiveTrace(searchLogger, () => `Object ${JSON.stringify(realValue)} does not match expected object ${JSON.stringify(expectedValue)}`);
						return false;
					}
				}

				// for anything else, we match with our regular expression or string
				if(expectedValue instanceof RegExp) {
					if(!expectedValue.test(typeof realValue === 'string' ? realValue : String(realValue as unknown))) {
						expensiveTrace(searchLogger, () => `Value ${JSON.stringify(realValue)} does not match expected regular expression ${expectedValue}`);
						return false;
					}
				} else if(typeof expectedValue !== 'object') {
					if(expectedValue !== realValue) {
						expensiveTrace(searchLogger, () => `Value ${JSON.stringify(realValue)} does not match expected string ${JSON.stringify(expectedValue)}`);
						return false;
					}
				}
			}

			expensiveTrace(searchLogger, () => `Object ${JSON.stringify(realChild)} matches ${JSON.stringify(expectedChild)}`);
			return true;
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
	}) satisfies FlowrFilterFunction<OriginKindArgs>,
	[FlowrFilter.RoleInParent]: ((e: FlowrSearchElement<ParentInformation>, { roleInParent }) => {
		return e.node.info.role === roleInParent;
	}) satisfies FlowrFilterFunction<{ roleInParent: RoleInParent }>,
	[FlowrFilter.FilePathFilter]: ((e: FlowrSearchElement<ParentInformation>, args: FilePathFilterArgs) => {
		const file = e.node.info.file;
		const rx = args.filePathRegex instanceof RegExp ? args.filePathRegex : new RegExp(args.filePathRegex);
		return rx.test(file ?? '');
	}) satisfies FlowrFilterFunction<FilePathFilterArgs>
} as const;
export type FlowrFilterArgs<F extends FlowrFilter> = typeof FlowrFilters[F] extends FlowrFilterFunction<infer Args> ? Args : never;

export interface MatchesEnrichmentArgs<E extends Enrichment> {
	enrichment:  E,
	/**
	 * The object to test the enrichment value against, which should be a partial {@link EnrichmentElementContent} with each value to test for replaced by a {@link RegExp} or value to match against. The test will pass if the partial structure matches and the enrichment value at each {@link RegExp}, string or primitive location matches the corresponding regular expression. For array entries, {@link arrayMatch} determines whether every element in the array has to match the given expected value, or only some.
	 */
	test:        Record<string, unknown>,
	/**
	 * For array entries, the expected value in {@link test} is compared against each array entry in the real value. This property determines whether every element in the array has to match, or only some. If unset, this defaults to `some`.
	 */
	arrayMatch?: 'some' | 'every'
}
export interface OriginKindArgs {
	origin:                BuiltInProcName | RegExp;
	matchType?:            'some' | 'every';
	keepNonFunctionCalls?: boolean
}
export interface FilePathFilterArgs {
	filePathRegex: string | RegExp
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
type LeafSpecial<F extends FlowrFilter = FlowrFilter> = { readonly type: 'special', readonly value: FlowrFilterName | FlowrFilterWithArgs<F, FlowrFilterArgs<F>> };

type Leaf = LeafRType | LeafVertexType | LeafSpecial;


type BooleanNode = BooleanBinaryNode<BooleanNode>
	| BooleanUnaryNode<BooleanNode>
	| Leaf;


type BooleanNodeOrCombinator = BooleanNode | FlowrFilterCombinator;

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

	public static is<F extends FlowrFilter = FlowrFilter>(value: BooleanNodeOrCombinator | ValidFilterTypes<F>): FlowrFilterCombinator {
		if(typeof value === 'string' && ValidFlowrFilters.has(value)) {
			return new this({ type: 'special', value: value as FlowrFilter });
		} else if(typeof value === 'object') {
			const name = (value as FlowrFilterWithArgs<F, FlowrFilterArgs<F>>)?.name;
			if(name && ValidFlowrFilters.has(name)) {
				return new this({ type: 'special', value: value as FlowrFilterWithArgs<F, FlowrFilterArgs<F>> } as LeafSpecial<F>);
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

	public static and<FLeft extends FlowrFilter = FlowrFilter, FRight extends FlowrFilter = FlowrFilter>(left: BooleanNodeOrCombinator | ValidFilterTypes<FLeft>, right: BooleanNodeOrCombinator | ValidFilterTypes<FRight>): FlowrFilterCombinator {
		return FlowrFilterCombinator.is(left).and(right);
	}

	public static or<FLeft extends FlowrFilter = FlowrFilter, FRight extends FlowrFilter = FlowrFilter>(left: BooleanNodeOrCombinator | ValidFilterTypes<FLeft>, right: BooleanNodeOrCombinator | ValidFilterTypes<FRight>): FlowrFilterCombinator {
		return FlowrFilterCombinator.is(left).or(right);
	}

	public static xor<FLeft extends FlowrFilter = FlowrFilter, FRight extends FlowrFilter = FlowrFilter>(left: BooleanNodeOrCombinator | ValidFilterTypes<FLeft>, right: BooleanNodeOrCombinator | ValidFilterTypes<FRight>): FlowrFilterCombinator {
		return FlowrFilterCombinator.is(left).xor(right);
	}

	public static not<F extends FlowrFilter = FlowrFilter>(value: BooleanNodeOrCombinator | ValidFilterTypes<F>): FlowrFilterCombinator {
		return FlowrFilterCombinator.is(value).not();
	}

	public and<F extends FlowrFilter = FlowrFilter>(right: BooleanNodeOrCombinator | ValidFilterTypes<F>): this {
		return this.binaryRight('and', right);
	}

	public or<F extends FlowrFilter = FlowrFilter>(right: BooleanNodeOrCombinator | ValidFilterTypes<F>): this {
		return this.binaryRight('or', right);
	}

	public xor<F extends FlowrFilter = FlowrFilter>(right: BooleanNodeOrCombinator | ValidFilterTypes<F>): this {
		return this.binaryRight('xor', right);
	}

	private binaryRight<F extends FlowrFilter = FlowrFilter>(op: BooleanBinaryNode<BooleanNode>['type'], right: BooleanNodeOrCombinator | ValidFilterTypes<F>): this {
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
	if(filter instanceof FlowrFilterCombinator) {
		return evalTree(filter.get(), data);
	} else if(typeof filter === 'string' && ValidFlowrFilters.has(filter)) {
		const handler = FlowrFilters[filter as FlowrFilter];
		return handler(data.element, undefined as unknown as FlowrFilterArgs<FlowrFilter>, data.data);
	} else if(typeof filter === 'object' && 'name' in filter) {
		const handler = FlowrFilters[filter.name];
		const args = ('args' in filter ? filter.args : undefined) as unknown as never;
		return handler(data.element, args, data.data);
	} else {
		const tree = FlowrFilterCombinator.is(filter as FlowrFilterExpression);
		return evalTree(tree.get(), data);
	}
}
