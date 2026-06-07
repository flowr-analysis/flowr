import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { TaintMapper } from './function-mapper';
import { mapFnCallToTaint, resolveTaint } from './function-mapper';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';
import type { TaintProduct, TaintReduction } from './taint-product-domain';
import { TaintProductDomain } from './taint-product-domain';

/**
 * A single component of a composite taint analysis, i.e. one of the combined taint analyses.
 * It bundles the analysis name (used as the product key), its (value) abstract domain, and its function mapper.
 * Note that {@link TaintAnalysisDefinition} structurally conforms to this interface.
 * @template Domain - The (value) abstract domain of the component analysis
 */
export interface TaintComponent<Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	/** The unique name of the component analysis, used as the key within the {@link TaintProduct}. */
	readonly name:   string;
	/** The (value) abstract domain (taint lattice) of the component analysis. */
	readonly domain: Domain;
	/** The function mapper relating function names to the tainting behaviour of the component analysis. */
	readonly mapper: TaintMapper<Domain>;
}

/**
 * Abstract interpretation visitor for conducting composite taint analyses.
 *
 * In contrast to the single-domain {@link TaintInferenceVisitor}, this visitor evaluates multiple component taint
 * analyses simultaneously during a single control-flow traversal and combines their taints into a product of the
 * lattice values per each CFG node. The product is stored in a {@link StateAbstractDomain} of a
 * {@link TaintProductDomain}, so joins at CFG merge points (as well as widening, meet, and narrowing) are performed
 * component-wise. Optional reductions turn the otherwise direct product into a reduced product, allowing the
 * component analyses to refine each other.
 *
 * Please prefer using {@link TaintAnalysisDefinition.compose} together with the {@link FlowrAnalyzer.taint} method to
 * create a composite taint analysis.
 */
export class CompositeTaintInferenceVisitor extends AbstractInterpretationVisitor<StateAbstractDomain<TaintProductDomain>> {
	private readonly components: readonly TaintComponent[];

	constructor(
		components: readonly TaintComponent[],
		reductions: readonly TaintReduction[],
		visitorConfig: AbsintVisitorConfiguration
	) {
		const template = Object.fromEntries(components.map(component => [component.name, component.domain])) as Required<TaintProduct>;
		super(
			{ ...visitorConfig, ignoreUnsupportedFunctions: false },
			StateAbstractDomain.top(TaintProductDomain.top(template, reductions))
		);
		this.components = components;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return;
		}
		const product: TaintProduct = {};

		for(const component of this.components) {
			const taint = mapFnCallToTaint(node, component.mapper, this.config.dfg, this.config.ctx);

			// project the product state of an argument node onto the component of this analysis (defaulting to Top)
			product[component.name] = resolveTaint(taint, component.domain, argId =>
				this.getAbstractValue(argId)?.value[component.name] ?? component.domain.top());
		}
		this.currentState.set(node.info.id, this.currentState.domain.create(product));
	}
}
