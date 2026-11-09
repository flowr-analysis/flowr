import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { AbstractInterpreter, type AbsintVisitorConfiguration, type DomainSemantics } from '../abstract-interpretation/absint-inference';
import type { AbsintContext, AbstractSemantics } from '../abstract-interpretation/abstract-semantics';
import type { AbstractProduct, ProductReduction } from '../abstract-interpretation/domains/partial-product-domain';
import type { StateDomain } from '../abstract-interpretation/domains/state-domain';
import { resolveFnCallToTaint } from './taint-resolve';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { FnCallHookInfo } from './builder/taint-analysis';
import { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { Identifier } from '../dataflow/environments/identifier';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { TaintMapper } from './taint-mapping';
import type { TaintProvenanceTracker } from './provenance/taint-provenance-tracker';

/**
 * Function calls the taint analysis is able to handle:
 * named function calls like `f(x)`, method calls (`obj$f(x)`), operators (`x + y`, `-x`), accesses (`x$a`, `x[[1]]`),
 * and functions applied by others (`readLines` in `do.call(readLines, args)`)
 */
export type TaintCallNode = RFunctionCall<ParentInformation> | RBinaryOp<ParentInformation> | RUnaryOp<ParentInformation> | RAccess<ParentInformation> | RSymbol<ParentInformation>;

/** the method `obj$method(...)` calls, as `$method` */
function methodName(node: RNode<ParentInformation> | undefined): Identifier | undefined {
	const field = RFunctionCall.isUnnamed(node) && RAccess.isNamed(node.calledFunction) ? node.calledFunction.access[0]?.value : undefined;
	return RSymbol.is(field) ? Identifier.make(`$${Identifier.getName(field.content)}`) : undefined;
}

/** Whether the given AST node can be handled by the taint analysis (see {@link TaintCallNode}). */
export function isTaintableCallNode(node: RNode<ParentInformation> | undefined): node is TaintCallNode {
	return RFunctionCall.isNamed(node) || RBinaryOp.is(node) || RUnaryOp.is(node) || RAccess.is(node) || RSymbol.is(node) || methodName(node) !== undefined;
}

/** The name mappings of a call are looked up by: the called function, or `$method` for a method call `obj$method(...)` */
export function taintCallName(call: DataflowGraphVertexFunctionCall, node: RNode<ParentInformation> | undefined): Identifier {
	return methodName(node) ?? call.name;
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
	provenance?: TaintProvenanceTracker;
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
function taintSemantics<Domain extends AnyAbstractDomain>({ domain, mapper }: TaintComponent<Domain>, fnCallHook?: TaintVisitorHook, provenance?: TaintProvenanceTracker): AbstractSemantics<StateDomain<Domain>> {
	const handleCall = (state: StateDomain<Domain>, call: DataflowGraphVertexFunctionCall, ctx: AbsintContext<StateDomain<Domain>>, explicitOnly: boolean): void => {
		const node = ctx.getAstNode(call.id);
		const name = taintCallName(call, node);
		const mappings = mapper.getMappings(name);
		if(!isTaintableCallNode(node) || ((explicitOnly || name !== call.name || RSymbol.is(node)) && !mappings.some(m => m.category === undefined))) {
			return;
		}
		const projectArg = (id: NodeId): Domain | undefined => ctx.getAbstractValue(id);
		const resolved = resolveFnCallToTaint(call, mappings, domain, projectArg, ctx.dfg, ctx.context);
		const { value, role, category } = resolved;
		state.set(call.id, value);
		provenance?.record(call, resolved, projectArg);
		fnCallHook?.({ node, value, wasMapped: mappings.length > 0, projectArg, call, role, category });
	};
	return {
		handleFunctionCall: (state, call, ctx) => handleCall(state, call, ctx, false),
		/* accesses are only tracked with explicit mappings */
		handleAccessCall:   (state, call, ctx) => handleCall(state, call, ctx, true),
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
		const semantics = Object.fromEntries(components.map(c => [c.name, taintSemantics(c, config.fnCallHook, config.provenance)])) as DomainSemantics<TaintProduct>;
		/* a component missing from a state is simply unknown, so the reductions see the product as partial */
		super(config, { domains, semantics, reductions: reductions as readonly ProductReduction<Partial<TaintProduct>>[], collapseOnBottom: false });
	}

	public override start(): void {
		super.start();
		this.interpretUncalledFunctions();
	}

	/* taint flows through environment-changing calls as well, so they do not discard what is known */
	protected override isUnsupportedFunctionCall(_nodeId: NodeId): boolean {
		return false;
	}
}
