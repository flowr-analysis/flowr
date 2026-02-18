import type { SourceRange } from '../../../../util/range';
import { SourceLocation } from '../../../../util/range';
import type { RType } from './type';
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
import type { RFunctionCall } from './nodes/r-function-call';
import type { RParameter } from './nodes/r-parameter';
import type { RArgument } from './nodes/r-argument';
import type { RExpressionList } from './nodes/r-expression-list';
import type { RIndexAccess, RNamedAccess } from './nodes/r-access';
import type { RUnaryOp } from './nodes/r-unary-op';
import type { RBinaryOp } from './nodes/r-binary-op';
import type { RPipe } from './nodes/r-pipe';
import type { RDelimiter } from './nodes/info/r-delimiter';
import type { ParentInformation } from './processing/decorate';
import type { NodeId } from './processing/node-id';
import type { OnEnter, OnExit } from './processing/visitor';
import { NodeVisitor } from './processing/visitor';
import type { SingleOrArrayOrNothing } from '../../../../abstract-interpretation/normalized-ast-fold';

/** Simply an empty type constraint used to say that there are additional decorations (see {@link RAstNodeBase}). */
export type NoInfo = object;

/**
 * Will be used to reconstruct the source of the given element in the R-ast.
 * This will not be part of most comparisons as it is mainly of interest to the reconstruction of R code.
 */
interface Source {
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
 * This subtype of {@link RNode} represents all types of {@link Leaf} nodes in the
 * normalized AST.
 */
export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info> | RBreak<Info> | RNext<Info> | RLineDirective<Info>;
/**
 * This subtype of {@link RNode} represents all looping constructs in the normalized AST.
 */
export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>;
/**
 * As an extension to {@link RLoopConstructs}, this subtype of {@link RNode} includes
 * the {@link RIfThenElse} construct as well.
 */
export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>;
/**
 * This subtype of {@link RNode} represents all types related to functions
 * (calls and definitions) in the normalized AST.
 */
export type RFunctions<Info>      = RFunctionDefinition<Info> | RFunctionCall<Info> | RParameter<Info> | RArgument<Info>;
/**
 * This subtype of {@link RNode} represents all types of otherwise hard to categorize
 * nodes in the normalized AST. At the moment these are the comment-like nodes.
 */
export type ROther<Info>          = RComment<Info> | RLineDirective<Info>;

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
 * @see {@link DefaultNormalizedAstFold} - for a more powerful way to traverse the normalized AST
 */
export const RNode = {
	name: 'RNode',
	/**
	 * A helper function to retrieve the location of a given node, if available.
	 * @see SourceLocation.fromNode
	 */
	getLocation(this: void, node: RNode): SourceLocation | undefined {
		return SourceLocation.fromNode(node);
	},
	/**
	 * A helper function to retrieve the id of a given node, if available.
	 */
	getId(this: void, node: RNode<ParentInformation>): NodeId {
		return node.info.id;
	},
	/**
	 * A helper function to retrieve the type of a given node.
	 */
	getType(this: void, node: RNode): RType {
		return node.type;
	},
	/**
	 * Visits all node ids within a tree given by a respective root node using a depth-first search with prefix order.
	 * @param nodes          - The root id nodes to start collecting from
	 * @param onVisit        - Called before visiting the subtree of each node. Can be used to stop visiting the subtree starting with this node (return `true` stop)
	 * @param onExit         - Called after the subtree of a node has been visited, called for leafs too (even though their subtree is empty)
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
	 * Collects all node ids within a tree given by a respective root node, but stops collecting at nodes where the given `stop` function returns `true`.
	 * <p>
	 * This can be used to exclude certain subtrees from the collection, for example to exclude function bodies when collecting ids on the root level.
	 * @param nodes - The root id nodes to start collecting from
	 * @param stop - A function that determines whether to stop collecting at a given node, does not stop by default
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
	}
} as const;

export type OtherInfoNode = RNode | RDelimiter;

