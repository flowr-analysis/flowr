import { AbstractInterpreter, type AbsintVisitorConfiguration, type DomainSemantics } from '../abstract-interpretation/absint-inference';
import type { AbstractSemantics } from '../abstract-interpretation/abstract-semantics';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { AbstractProduct, ProductReduction } from '../abstract-interpretation/domains/partial-product-domain';
import type { StateDomain } from '../abstract-interpretation/domains/state-domain';
import { resolveFnCallToTaint } from './taint-resolve';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FnCallHookInfo } from './builder/taint-analysis';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { TaintMapper } from './taint-mapping';

/**
 * Function calls the taint analysis is able to handle:
 * named function calls like `f(x)` and operators, including binary operators (`x + y`) and unary operators (`-x`)
 */
export type TaintCallNode = RNamedFunctionCall<ParentInformation> | RBinaryOp<ParentInformation> | RUnaryOp<ParentInformation>;

/** Whether the given AST node can be handled by the taint analysis (see {@link TaintCallNode}). */
export function isTaintableCallNode(node: RNode<ParentInformation> | undefined): node is TaintCallNode {
	return RFunctionCall.isNamed(node) || RBinaryOp.is(node) || RUnaryOp.is(node);
}

/**
 * Resolves the inferred abstract taint of an argument node at the current program point, independent of any mapping
 * rule. Returns `undefined` if no taint was inferred for the node.
 */
export type ArgTaintProjector = (id: NodeId) => AnyAbstractDomain | undefined;

/**
 * Callback hook invoked when a function call is visited during taint inference.
 * @param taint      - The resolved taint information for the function call
 * @param node       - The AST node representing the function call
 * @param value      - The abstract domain value at this point in the analysis
 * @param projectArg - Resolves the incoming taint of any argument node, regardless of mapping rules
 * @param call       - The data flow graph vertex of the function call
 * @param role       - The role of the matched mapping (source/propagator/sink), or `undefined` for unmapped calls
 */
export type TaintVisitorHook = (info: Omit<FnCallHookInfo, 'name' | 'dfg' | 'ctx'>) => void;

/**
 * Configuration for the taint inference.
 */
export type TaintVisitorConfiguration = AbsintVisitorConfiguration & {
	/** Callbacks invoked when each function call is visited during taint inference */
	fnCallHook?: TaintVisitorHook;
};

/**
 * The abstract product mapping the name of a (component) taint analysis to its (value) abstract domain.
 * Each property of the product holds the inferred taint of the respective component analysis.
 */
export type TaintProduct = AbstractProduct;

/**
 * A single component of a taint analysis, i.e. one of the combined taint analyses.
 * It bundles the analysis name (used as the product key), its (value) abstract domain, and its function mapper.
 * Note that {@link TaintAnalysisDefinition} structurally conforms to this interface.
 * @template Domain - The (value) abstract domain of the component analysis
 */
export interface TaintComponent<Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	/** The unique name of the component analysis, used as the key within the {@link TaintProduct}. */
	readonly name:   string;
	/** The (value) abstract domain (taint lattice) of the component analysis. */
	readonly domain: Domain;
	/** The function mapper relating function names to the tainting behavior of the component analysis. */
	readonly mapper: TaintMapper<Domain>;
}

/** The abstract semantics of a taint component: every taintable call gets the taint its mappings resolve to. */
function taintSemantics<Domain extends AnyAbstractDomain>({ domain, mapper }: TaintComponent<Domain>, fnCallHook?: TaintVisitorHook): AbstractSemantics<StateDomain<Domain>> {
	return {
		handleFunctionCall(state, call, ctx) {
			const node = ctx.getAstNode(call.id);
			if(!isTaintableCallNode(node)) {
				return;
			}
			const mappings = mapper.getMappings(call.name);
			const projectArg = (id: NodeId): Domain | undefined => ctx.getAbstractValue(id);
			const { value, role, category } = resolveFnCallToTaint(call, mappings, domain, projectArg, ctx.dfg, ctx.context);
			state.set(call.id, value);
			fnCallHook?.({ node, value, wasMapped: mappings.length > 0, projectArg, call, role, category });
		},
		handleAssignmentCall(state, _call, ctx, target, source) {
			const value = ctx.getAbstractValue(source);
			if(value === undefined) {
				state.remove(target);
			} else {
				state.set(target, value);
			}
		}
	};
}

/**
 * Abstract interpreter conducting taint analyses, i.e. applying finite taint lattices on the control-flow graph.
 * All components are evaluated simultaneously during a single control-flow traversal and their taints are combined into
 * a product of the lattice values per CFG node, joined (and widened) component-wise. Optional reductions turn the
 * otherwise direct product into a reduced product, allowing the component analyses to refine each other.
 * A node reaching Bottom marks a finding, so it does not collapse the state.
 *
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintInterpreter extends AbstractInterpreter<TaintProduct> {
	constructor(
		components: readonly TaintComponent[],
		config: TaintVisitorConfiguration,
		reductions: readonly ProductReduction<TaintProduct>[] = []
	) {
		const domains = Object.fromEntries(components.map(c => [c.name, c.domain])) as Required<TaintProduct>;
		const semantics = Object.fromEntries(components.map(c => [c.name, taintSemantics(c, config.fnCallHook)])) as DomainSemantics<TaintProduct>;
		/* a component missing from a state is simply unknown, so the reductions see the product as partial */
		super(config, { domains, semantics, reductions: reductions as readonly ProductReduction<Partial<TaintProduct>>[], collapseOnBottom: false });
	}

	/* taint flows through environment-changing calls as well, so they do not discard what is known */
	protected override isUnsupportedFunctionCall(_nodeId: NodeId): boolean {
		return false;
	}
}
