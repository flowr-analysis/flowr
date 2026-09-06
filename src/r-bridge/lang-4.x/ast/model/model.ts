import { SourceLocation, SourceRange } from '../../../../util/range';
import type { Accessor } from '../../../../util/accessor';
import { RType } from './type';
import type { MergeableRecord } from '../../../../util/objects';
import type { RNumber } from './nodes/r-number';
import type { RString } from './nodes/r-string';
import type { RLogical } from './nodes/r-logical';
import type { RSymbol } from './nodes/r-symbol';
import type { RComment } from './nodes/r-comment';
import type { RBreak } from './nodes/r-break';
import type { RNext } from './nodes/r-next';
import type { RLineDirective } from './nodes/r-line-directive';
import type { RForLoop } from './nodes/r-for-loop';
import type { RRepeatLoop } from './nodes/r-repeat-loop';
import type { RWhileLoop } from './nodes/r-while-loop';
import type { RIfThenElse } from './nodes/r-if-then-else';
import type { RFunctionDefinition } from './nodes/r-function-definition';
import type { EmptyArgument, RFunctionCall } from './nodes/r-function-call';
import type { RParameter } from './nodes/r-parameter';
import type { RArgument } from './nodes/r-argument';
import type { RExpressionList } from './nodes/r-expression-list';
import type { RIndexAccess, RNamedAccess } from './nodes/r-access';
import { RAccess } from './nodes/r-access';
import type { RUnaryOp } from './nodes/r-unary-op';
import type { RBinaryOp } from './nodes/r-binary-op';
import type { RPipe } from './nodes/r-pipe';
import type { RDelimiter } from './nodes/info/r-delimiter';
import type { AstIdMap, ParentInformation } from './processing/decorate';
import type { NodeId } from './processing/node-id';
import type { OnEnter, OnExit } from './processing/visitor';
import { NodeVisitor } from './processing/visitor';
import { assertUnreachable } from '../../../../util/assert';
import { getDocumentationOf } from '../../../roxygen2/documentation-provider';

export type SingleOrArrayOrNothing<T> = T | readonly (T | null | undefined)[] | null | undefined;

/** Simply an empty type constraint used to say that there are additional decorations (see {@link RAstNodeBase}). */
export type NoInfo = object;

/**
 * Will be used to reconstruct the source of the given element in the R-ast.
 * This will not be part of most comparisons as it is mainly of interest to the reconstruction of R code.
 */
export interface Source {
	/**
	 * The range is different from the assigned {@link Location} as it refers to the complete source range covered by the given
	 * element.
	 * <p>
	 * As an example for the difference, consider a for loop, the location of `for` will be just the three characters,
	 * but the *range* will be everything including the loop body.
	 */
	fullRange?:  SourceRange
	/**
	 * Similar to {@link Source.fullRange} this contains the complete R lexeme of the given element.
	 * This is the lexeme of the element itself, never that of an enclosing one: the field of `a$b` reports `b`.
	 */
	fullLexeme?: string
	/**
	 * This may contain additional elements that were part of the original R code, but are not part of the normalized R-ast.
	 * This allows inline-comments!
	 */
	adToks?:     OtherInfoNode[]
	/**
	 * The file in which the respective node is located
	 */
	file?:       string
}

/**
 * Provides the common base of all {@link RNode|RNodes}.
 * @typeParam Info       - can be used to store additional information about the node
 * @typeParam LexemeType - the type of the lexeme, probably always a `string` or `string | undefined`
 */
export interface RAstNodeBase<Info, LexemeType = string> extends MergeableRecord {
	type:   RType
	/** the original string retrieved from R, can be used for further identification */
	lexeme: LexemeType
	/** allows to attach additional information to the node */
	info:   Info & Source
}

export interface WithChildren<Info, Children extends RAstNodeBase<Info, string | undefined>> {
	children: readonly Children[]
}

/**
 * A helper interface we use to "mark" leaf nodes.
 * <p>
 * Please be aware, that this is not marking from a language perspective,
 * as it is equivalent to the {@link RAstNodeBase} interface.
 * It is intended to help humans understand the code.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Leaf<Info = NoInfo, LexemeType = string> extends RAstNodeBase<Info, LexemeType> {}

/**
 * Indicates, that the respective {@link RAstNodeBase} node has known source code
 * location information.
 */
export interface Location {
	/**
	 * The location may differ from what is stated in {@link Source#fullRange} as it
	 * represents the location identified by the R parser.
	 * @see Source#fullRange
	 */
	location: SourceRange
}

/**
 * Represents the type of namespaces in the R programming language.
 * At the moment, this is only the name of the namespace.
 */
export type NamespaceIdentifier = string;

/**
 * This subtype of {@link RNode} represents all types of constants
 * represented in the normalized AST.
 */
export type RConstant<Info>       = RNumber<Info> | RString<Info> | RLogical<Info>;
/**
 * Helper object to provide helper functions for {@link RConstant|RConstants}.
 * @see {@link RNode} - for more general helper functions for all nodes
 */
export const RConstant = {
	name: 'RConstant',
	/**
	 * Type guard for {@link RConstant} nodes, i.e. checks whether a node is a number, string or logical constant.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RNumber.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RConstant<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return t === RType.Number || t === RType.String || t === RType.Logical;
	},
	/**
	 * A set of all types of constants in the normalized AST, i.e. number, string, and logical constants.
	 */
	constantTypes: new Set([RType.Number, RType.String, RType.Logical]) as ReadonlySet<RType>
} as const;
/**
 * This subtype of {@link RNode} represents all types of {@link Leaf} nodes in the
 * normalized AST.
 */
export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info> | RBreak<Info> | RNext<Info> | RLineDirective<Info>;
/**
 * Represents a leaf node in the normalized AST, i.e. a node that does not have any children. This includes comment, symbol, constant, break, next, and line directive nodes.
 */
export const RSingleNode = {
	name: 'RSingleNode',
	/**
	 * Type guard for {@link RSingleNode} nodes, i.e. checks whether a node is a comment, symbol, constant, break, next or line directive.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RComment.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RSingleNode<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return t === RType.Comment || t === RType.Symbol || RConstant.constantTypes.has(t) || t === RType.Break || t === RType.Next || t === RType.LineDirective;
	},
	/**
	 * A set of all types of single nodes in the normalized AST, i.e. comment, symbol, constant, break, next, and line directive nodes.
	 */
	singleNodeTypes: new Set([RType.Comment, RType.Symbol, RType.Break, RType.Next, RType.LineDirective, ...RConstant.constantTypes]) as ReadonlySet<RType>
} as const;
/**
 * This subtype of {@link RNode} represents all looping constructs in the normalized AST.
 */
export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>;
export const RLoopConstructs = {
	name: 'RLoopConstructs',
	/**
	 * Type guard for {@link RLoopConstructs} nodes, i.e. checks whether a node is a for, repeat or while loop.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RForLoop.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RLoopConstructs<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return t === RType.ForLoop || t === RType.RepeatLoop || t === RType.WhileLoop;
	},
	/**
	 * A set of all types of loop constructs in the normalized AST, i.e. for, repeat and while loops.
	 */
	loopConstructTypes: new Set([RType.ForLoop, RType.RepeatLoop, RType.WhileLoop]) as ReadonlySet<RType>
} as const;
/**
 * As an extension to {@link RLoopConstructs}, this subtype of {@link RNode} includes
 * the {@link RIfThenElse} construct as well.
 */
export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>;
export const RConstructs = {
	name: 'RConstructs',
	/**
	 * Type guard for {@link RConstructs} nodes, i.e. checks whether a node is a for, repeat or while loop or an if-then-else construct.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RForLoop.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RConstructs<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return RLoopConstructs.loopConstructTypes.has(t) || t === RType.IfThenElse;
	},
	/**
	 * A set of all types of constructs in the normalized AST, i.e. for, repeat and while loops and if-then-else constructs.
	 */
	constructTypes: new Set([...RLoopConstructs.loopConstructTypes, RType.IfThenElse]) as ReadonlySet<RType>
} as const;
/**
 * This subtype of {@link RNode} represents all types related to functions
 * (calls and definitions) in the normalized AST.
 */
export type RFunctions<Info>      = RFunctionDefinition<Info> | RFunctionCall<Info> | RParameter<Info> | RArgument<Info>;
export const RFunctions = {
	name: 'RFunctions',
	/**
	 * Type guard for {@link RFunctions} nodes, i.e. checks whether a node is a function definition, function call, parameter or argument.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RFunctionDefinition.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RFunctions<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return t === RType.FunctionDefinition || t === RType.FunctionCall || t === RType.Parameter || t === RType.Argument;
	},
	/**
	 * A set of all types of function-related nodes in the normalized AST, i.e. function definitions, function calls, parameters, and arguments.
	 */
	functionTypes: new Set([RType.FunctionDefinition, RType.FunctionCall, RType.Parameter, RType.Argument]) as ReadonlySet<RType>
} as const;
/**
 * This subtype of {@link RNode} represents all types of otherwise hard to categorize
 * nodes in the normalized AST. At the moment these are the comment-like nodes.
 */
export type ROther<Info>          = RComment<Info> | RLineDirective<Info>;
export const ROther = {
	name: 'ROther',
	/**
	 * Type guard for {@link ROther} nodes, i.e. checks whether a node is a comment or line directive.
	 * If you need the specific type, please either use the respective type guards (e.g., {@link RComment.is}) or check the `type` node directly.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is ROther<Info> {
		if(!node) {
			return false;
		}
		const t = node.type;
		return t === RType.Comment || t === RType.LineDirective;
	}
} as const;

/**
 * The `RNode` type is the union of all possible nodes in the R-ast.
 * It should be used whenever you either not care what kind of
 * node you are dealing with or if you want to handle all possible nodes.
 * <p>
 *
 * All other subtypes (like {@link RLoopConstructs}) listed above
 * can be used to restrict the kind of node. They do not have to be
 * exclusive, some nodes can appear in multiple subtypes.
 * @see {@link recoverName} - to receive the name/lexeme from such a node
 * @see {@link recoverContent} - for a more rigorous approach to get the content of a node within a {@link DataflowGraph|dataflow graph}
 * @see {@link RNode.getLocation} - to get the location of a node and other helpful functions provided by the {@link RNode} helper object
 */
export type RNode<Info = NoInfo>  = RExpressionList<Info> | RFunctions<Info>
	| ROther<Info> | RConstructs<Info> | RNamedAccess<Info> | RIndexAccess<Info>
	| RUnaryOp<Info> | RBinaryOp<Info> | RSingleNode<Info>  | RPipe<Info>;

/**
 * Helper object to provide helper functions for {@link RNode|RNodes}.
 * For the individual type checks, please consult the individual vertices, e.g. {@link RPipe.is}.
 * Some vertices also have a {@link RPipe.availableFromRVersion} property that indicates from which R version they are available,
 * so you can check for that as well if needed.
 */
export const RNode = {
	name: 'RNode',
	/**
	 * A helper function to retrieve the location of a given node, if available.
	 * @see SourceLocation.fromNode
	 */
	getLocation(this: void, node: RNode | undefined): SourceLocation | undefined {
		return SourceLocation.fromNode(node);
	},
	/**
	 * A helper function to retrieve the id of a given node, `undefined` if there is no node.
	 */
	getId: ((node?: RNode<ParentInformation>) => node?.info.id) as Accessor<RNode<ParentInformation>, NodeId>,
	/**
	 * An identity for `node` that two analyses of the same source agree on, unlike {@link RNode.getId|the numeric
	 * id}, which only means something within the analysis that handed it out. Made of the file the node came
	 * from, where it starts, and what it is: `<file>:<line>:<column>:<type>`.
	 *
	 * This survives re-analyzing the same text, not editing it -- an edit above the node moves it.
	 * `undefined` for a node that carries no location (an artificial node, e.g. a built-in).
	 */
	stableId(this: void, node: RNode<ParentInformation> | undefined): string | undefined {
		const location = node?.location;
		return location === undefined ? undefined : `${node?.info.file ?? ''}:${location[0]}:${location[1]}:${node?.type}`;
	},
	/**
	 * The source range the whole subtree of `node` covers, from the first position any of its nodes starts at to
	 * the last one any of them ends at. Unlike {@link SourceRange.fromNode} this does not stop at what the node
	 * itself is written as: the span of the `<-` in a multi-line assignment is the whole assignment.
	 * `undefined` if neither the node nor anything below it carries a location.
	 * @see {@link RNode.topLevelStatement} - for the node to ask this of when the whole statement is wanted
	 */
	span<OtherInfo>(this: void, node: RNode<OtherInfo> | undefined): SourceRange | undefined {
		const ranges: SourceRange[] = [];
		RNode.visitAst(node, n => {
			const range = SourceRange.fromNode(n);
			if(range !== undefined) {
				ranges.push(range);
			}
		});
		return ranges.length > 0 ? SourceRange.merge(ranges) : undefined;
	},
	/**
	 * The top-level statement `node` belongs to: the ancestor that is a direct child of the root of its file
	 * (`node` itself if it already is one). A node with no parent is its own statement.
	 */
	topLevelStatement<OtherInfo>(this: void, node: RNode<OtherInfo & ParentInformation>, idMap: AstIdMap<OtherInfo & ParentInformation>): RNode<OtherInfo & ParentInformation> {
		let current = node;
		for(;;) {
			const parent = current.info.parent === undefined ? undefined : idMap.get(current.info.parent);
			/* the root of a file has no parent of its own, so the node below it is the statement */
			if(parent?.info.parent === undefined) {
				return current;
			}
			current = parent;
		}
	},
	/**
	 * Walks up from `id` along the AST parent chain (itself included), returning the id of the first node for
	 * which `isTarget` holds, `undefined` if the walk reaches the root of the file without a match.
	 */
	findEnclosing<OtherInfo>(this: void, id: NodeId, idMap: AstIdMap<OtherInfo & ParentInformation>, isTarget: (node: RNode<OtherInfo & ParentInformation>) => boolean): NodeId | undefined {
		let node = idMap.get(id);
		while(node !== undefined) {
			if(isTarget(node)) {
				return node.info.id;
			}
			node = node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
		}
		return undefined;
	},
	/**
	 * A helper function to retrieve the type of a given node.
	 */
	getType(this: void, node: RNode): RType {
		return node.type;
	},
	/**
	 * Visits all node ids within a tree given by a respective root node using a depth-first search with prefix order.
	 * @param nodes   - The root id nodes to start collecting from
	 * @param onVisit - Called before visiting the subtree of each node. Can be used to stop visiting the subtree starting with this node (return `true` stop)
	 * @param onExit  - Called after the subtree of a node has been visited, called for leafs too (even though their subtree is empty)
	 * @see {@link RProject.visitAst} - to visit all nodes in a project
	 */
	visitAst<OtherInfo = NoInfo>(this: void, nodes: SingleOrArrayOrNothing<RNode<OtherInfo>>, onVisit?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>): void {
		return new NodeVisitor(onVisit, onExit).visit(nodes);
	},
	/**
	 * Collects all node ids within a tree given by a respective root node
	 * @param nodes - The root id nodes to start collecting from
	 * @see {@link collectAllIdsWithStop} - to stop collecting at certain nodes
	 * @see {@link RProject.collectAllIds} - to collect all ids within a project
	 */
	collectAllIds<OtherInfo>(this: void, nodes: SingleOrArrayOrNothing<RNode<OtherInfo & ParentInformation>>): Set<NodeId> {
		const ids = new Set<NodeId>();
		RNode.visitAst(nodes, node => {
			ids.add(node.info.id);
		});
		return ids;
	},
	/**
	 * Collects all direct children of a given node, i.e. all nodes that are directly reachable via a property of the given node.
	 */
	directChildren<OtherInfo>(this: void, node: RNode<OtherInfo>): readonly (RNode<OtherInfo> | typeof EmptyArgument)[] {
		const type = node.type;
		switch(type) {
			case RType.FunctionCall:       return [node.named ? node.functionName : node.calledFunction, ...node.arguments];
			case RType.FunctionDefinition: return [...node.parameters, node.body];
			case RType.ExpressionList:     return node.grouping ? [node.grouping[0], ...node.children, node.grouping[1]] : node.children;
			case RType.ForLoop:            return [node.variable, node.vector, node.body];
			case RType.WhileLoop:          return [node.condition, node.body];
			case RType.RepeatLoop:         return [node.body];
			case RType.IfThenElse:         return node.otherwise ? [node.condition, node.then, node.otherwise] : [node.condition, node.then];
			case RType.BinaryOp:
			case RType.Pipe:               return [node.lhs, node.rhs];
			case RType.UnaryOp:            return [node.operand];
			case RType.Parameter:          return node.defaultValue ? [node.name, node.defaultValue] : [node.name];
			case RType.Argument:           return node.name && node.value ? [node.name, node.value] : node.name ? [node.name] : node.value ? [node.value] : [];
			case RType.Access:             return RAccess.isIndex(node) ? [node.accessed, ...node.access] : [node.accessed];
			case RType.Symbol: case RType.Logical: case RType.Number: case RType.String: case RType.Comment: case RType.Break: case RType.Next:
			case RType.LineDirective:      return [];
			default:
				assertUnreachable(type);
		}
	},
	/**
	 * Returns the direct parent of a node.
	 * Usually, only root nodes do not have a parent, and you can assume that there is a
	 * linear chain of parents leading to the root node.
	 * @see {@link iterateParents} - to get all parents of a node
	 */
	directParent<OtherInfo>(this: void, node: RNode<OtherInfo & ParentInformation>, idMap: AstIdMap<OtherInfo & ParentInformation>): RNode<OtherInfo & ParentInformation> | undefined {
		const parentId = node.info.parent;
		if(parentId === undefined) {
			return undefined;
		}
		return idMap.get(parentId);
	},
	/**
	 * Returns an iterable of all parents of a node, starting with the direct parent and ending with the root node.
	 */
	*iterateParents<OtherInfo>(this: void, node: RNode<OtherInfo & ParentInformation> | undefined, idMap: AstIdMap<OtherInfo & ParentInformation>): Generator<RNode<OtherInfo & ParentInformation>> {
		let currentNode: RNode<OtherInfo & ParentInformation> | undefined = node;
		while(currentNode) {
			currentNode = RNode.directParent(currentNode, idMap);
			if(currentNode) {
				yield currentNode;
			}
		}
	},
	/**
	 * In contrast to the nesting stored in the {@link RNode} structure,
	 * this function calculates the depth of a node by counting the number of parents until the root node is reached.
	 */
	depth(this: void, node: RNode<ParentInformation>, idMap: AstIdMap<ParentInformation>): number {
		let depth = 0;
		let currentNode: RNode | undefined = node;
		while(currentNode) {
			currentNode = RNode.directParent(currentNode as RNode<ParentInformation>, idMap);
			depth++;
		}
		return depth;
	},
	/**
	 * Collects all node ids within a tree given by a respective root node, but stops collecting at nodes where the given `stop` function returns `true`.
	 * <p>
	 * This can be used to exclude certain subtrees from the collection, for example to exclude function bodies when collecting ids on the root level.
	 * @param nodes - The root id nodes to start collecting from
	 * @param stop  - A function that determines whether to stop collecting at a given node, does not stop by default
	 * @see {@link collectAllIds} - to collect all ids without stopping
	 * @see {@link RProject.collectAllIdsWithStop} - to collect all ids within a project with stopping
	 */
	collectAllIdsWithStop<OtherInfo>(this: void, nodes: SingleOrArrayOrNothing<RNode<OtherInfo & ParentInformation>>, stop: (node: RNode<OtherInfo & ParentInformation>) => boolean): Set<NodeId> {
		const ids = new Set<NodeId>();
		RNode.visitAst(nodes, node => {
			if(stop(node)) {
				return true;
			}
			ids.add(node.info.id);
			return false;
		});
		return ids;
	},
	/**
	 * A helper function to retrieve the lexeme of a given node, if available.
	 * If the `fullLexeme` is available, it will be returned, otherwise the `lexeme` will be returned.
	 */
	lexeme<R extends RNode<ParentInformation>>(this: void, node: R | undefined): R extends { lexeme: string } ? string : string | undefined {
		return node?.info.fullLexeme ?? node?.lexeme as string;
	},
	/**
	 * Return the (roxygen) documentation associated with the given node, if available.
	 * @see {@link getDocumentationOf}
	 */
	documentation: getDocumentationOf
} as const;

export type OtherInfoNode = RNode | RDelimiter;

