import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { GenericDiffConfiguration, GenericDifferenceInformation, WriteableDifferenceReport } from './diff';
import type { DataflowGraph } from '../dataflow/graph/graph';

export interface NamedGraph<Graph = DataflowGraph> {
	name:  string,
	graph: Graph
}

interface ProblematicVertex {
	tag: 'vertex',
	id:  NodeId
}

interface ProblematicEdge {
	tag:  'edge',
	from: NodeId,
	to:   NodeId
}

export type ProblematicDiffInfo = ProblematicVertex | ProblematicEdge;

/**
 * To be produced by a function differencing two graphs (e.g., {@link DataflowGraph|DFGs} or {@link ControlFlowGraph|CFGs}).
 * @see {@link GraphDifferenceReport#isEqual|isEqual} - to check whether the graphs are equal
 * @see {@link GraphDifferenceReport#addComment|addComment} - to add comments to the report
 * @see {@link GraphDifferenceReport#comments|comments} - to get the attached comments
 * @see {@link GraphDifferenceReport#problematic|problematic} - to get the problematic vertices/edges
 */
export class GraphDifferenceReport implements WriteableDifferenceReport {
	_comments:    string[] | undefined = undefined;
	_problematic: ProblematicDiffInfo[] | undefined = undefined;

	addComment(comment: string, ...related: readonly ProblematicDiffInfo[]): void {
		if(this._comments === undefined) {
			this._comments = [comment];
		} else {
			this._comments.push(comment);
		}
		if(related.length > 0) {
			if(this._problematic === undefined) {
				this._problematic = [...related];
			} else {
				this._problematic.push(...related);
			}
		}
	}

	comments(): readonly string[] | undefined {
		return this._comments;
	}

	problematic(): readonly ProblematicDiffInfo[] | undefined {
		return this._problematic;
	}

	isEqual(): boolean {
		return this._comments === undefined;
	}
}

/**
 * A context that can be used by differencing functions to compare two graphs
 * See {@link initDiffContext} for a function that creates such a context.
 */
export interface GraphDiffContext<Graph = DataflowGraph> extends GenericDifferenceInformation<GraphDifferenceReport> {
	left:   Graph
	right:  Graph
	config: GenericDiffConfiguration
}

/**
 * Create the context for differencing two graphs
 */
export function initDiffContext<Graph>(left: NamedGraph<Graph>, right: NamedGraph<Graph>, config?: Partial<GenericDiffConfiguration>): GraphDiffContext<Graph> {
	return {
		left:      left.graph,
		leftname:  left.name,
		right:     right.graph,
		rightname: right.name,
		report:    new GraphDifferenceReport(),
		position:  '',
		config:    {
			rightIsSubgraph: false,
			leftIsSubgraph:  false,
			...config
		}
	};
}