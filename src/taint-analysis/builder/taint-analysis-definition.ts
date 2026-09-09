import type { TaintConditionFunction, TaintMapper } from '../function-mapper';
import { TaintRole } from '../function-mapper';
import type { AbsintVisitorConfiguration, AbstractInterpretationVisitor } from '../../abstract-interpretation/absint-visitor';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';
import type { TaintComponent, TaintProduct } from '../composite-taint-visitor';
import { CompositeTaintInferenceVisitor } from '../composite-taint-visitor';
import type { TaintVisitorConfiguration } from '../taint-visitor';
import { TaintInferenceVisitor } from '../taint-visitor';
import { guard } from '../../util/assert';
import type { ProductReduction } from '../../abstract-interpretation/domains/partial-product-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { TaintFnCategory } from '../function-categories';
import { resolveCategoryToTaintMappings } from '../function-categories';

export type TaintAnalysisName<Definition> =
	Definition extends RunnableTaintAnalysisDefinition<infer Name> ? Name : never;

/**
 * The common interface of all (runnable) taint analysis definitions, i.e. single {@link TaintAnalysisDefinition|definitions}
 * and {@link CompositeTaintAnalysisDefinition|composite definitions}. A runnable definition knows its name, an optional
 * report message, and how to create the abstract interpretation visitor that conducts the analysis.
 */
export interface RunnableTaintAnalysisDefinition<Name extends string = string> {
	/** The unique name of the taint analysis. */
	readonly name: Name;
	/** The optional message reported when the analysis produces a finding. */
	readonly msg?: string;
	/** Creates the abstract interpretation visitor that conducts the taint analysis for the given visitor configuration. */
	createVisitor(config: AbsintVisitorConfiguration): AbstractInterpretationVisitor<AnyStateDomain>;
}

/** Options for composing multiple taint analyses into a {@link CompositeTaintAnalysisDefinition}. */
export interface ComposeOptions {
	/**
	 * Optional reductions turning the direct product into a reduced product.
	 * Each reduction may refine the inferred taints of the component analyses based on each other.
	 */
	reductions?: readonly ProductReduction<TaintProduct>[];
	/** The optional message reported when the composite analysis produces a finding. */
	report?:     string;
}

export interface TaintAnalysisReportStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisToStage<Name, Domain> {
	/** Sets the message reported when the analysis produces a finding. */
	report(msg: string): TaintAnalysisDefinition<Name, Domain>;
}

export interface TaintAnalysisToStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisThroughStage<Name, Domain> {
	/** Adds sink rules signaling findings by yielding Bottom. */
	to(fnMapping: TaintMapper<Domain>): TaintAnalysisReportStage<Name, Domain>;
}

export interface TaintAnalysisThroughStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisFromStage<Name, Domain> {
	/** Adds propagator or sanitizer rules that determine the resulting taint of matching calls. */
	through(fnMapping: TaintMapper<Domain>): TaintAnalysisToStage<Name, Domain>;
}

export interface TaintAnalysisFromStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	/** Adds propagator or sanitizer rules that determine the resulting taint of matching calls. */
	from(fnMapping: TaintMapper<Domain>): TaintAnalysisThroughStage<Name, Domain>;
	/** Adds functions from TODO */
	/** TODO Make accessible from TaintAnalyzer? Provide defaults? */
	on(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>): TaintAnalysisFromStage<Name, Domain>;
}

/**
 * Fluent builder class for defining new taint analyses.
 * Use {@link TaintAnalysisDefinition.create} to obtain an instance;
 * The methods {@link TaintAnalysis.from}, {@link TaintAnalysis.through},
 * {@link TaintAnalysis.to}, and {@link TaintAnalysis.report} have to be called in order.
 */
export class TaintAnalysisDefinition<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration> implements TaintAnalysisReportStage<Name, Domain> {
	public readonly domain: Domain;
	public mapper:          TaintMapper<Domain> = [];
	public name:            Name;
	public config:          Config | undefined;

	private _msg: string | undefined;

	get msg(): string | undefined {
		return this._msg;
	}

	private constructor(name: Name, domain: Domain, config?: Config) {
		this.name = name;
		this.domain = domain;
		this.config = config;
	}

	/**
	 * Create a new taint analysis builder. {@link run} is unreachable on the result until at least
	 * one of {@link add}, {@link addComposite}, or {@link addPredefined} has been called on it.
	 */
	public static create<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>(name: Name, domain: Domain, config?: Config): TaintAnalysisFromStage<Name, Domain> {
		return new TaintAnalysisDefinition(name, domain, config);
	}

	public on(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>) {
		const resolved = resolveCategoryToTaintMappings<Domain>(category, handler);
		this.mapper.push(...resolved);
		return this;
	}

	public from(fnMapping: TaintMapper<Domain>): TaintAnalysisThroughStage<Name, Domain> {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: TaintRole.Source })));
		return this;
	}

	public through(fnMapping: TaintMapper<Domain>): TaintAnalysisToStage<Name, Domain> {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: TaintRole.Transformer })));
		return this;
	}

	public to(fnMapping: TaintMapper<Domain>): TaintAnalysisReportStage<Name, Domain> {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: TaintRole.Sink })));
		return this;
	}

	public report(msg: string): TaintAnalysisDefinition<Name, Domain> {
		this._msg = msg;
		return this;
	}

	public createVisitor(config: TaintVisitorConfiguration): AbstractInterpretationVisitor<AnyStateDomain> {
		return new TaintInferenceVisitor(this.domain, this.mapper, { ...this.config, ...config });
	}

	/**
	 * Composes at least two taint analysis definitions into a single composite taint analysis.
	 * The component analyses are evaluated simultaneously during a single control-flow traversal and their taints are
	 * combined into a product of the lattice values per each CFG node (see {@link CompositeTaintInferenceVisitor}).
	 * @param name        - The unique name of the resulting composite taint analysis
	 * @param definitions - The component taint analysis definitions to compose (must have unique names)
	 * @param options     - Optional reductions (for a reduced product) and a report message
	 */
	public static compose<Name extends string>(
		name: Name,
		definitions: readonly TaintAnalysisDefinition[],
		options?: ComposeOptions
	): CompositeTaintAnalysisDefinition<Name> {
		return new CompositeTaintAnalysisDefinition(name, definitions, options);
	}
}

/**
 * A composite taint analysis definition combining multiple {@link TaintAnalysisDefinition|component analyses} into a
 * product (or reduced product) taint analysis. Create instances via {@link TaintAnalysisDefinition.compose}.
 */
export class CompositeTaintAnalysisDefinition<Name extends string> implements RunnableTaintAnalysisDefinition<Name> {
	public readonly name:        Name;
	public readonly definitions: readonly TaintAnalysisDefinition[];
	public readonly reductions:  readonly ProductReduction<TaintProduct>[];

	public msg: string | undefined;

	constructor(name: Name, definitions: readonly TaintAnalysisDefinition[], options?: ComposeOptions) {
		guard(definitions.length >= 2, 'A composite taint analysis must combine at least two taint analysis definitions');
		const names = definitions.map(def => def.name);
		guard(new Set(names).size === names.length, 'A composite taint analysis requires unique component analysis names');

		this.name = name;
		this.definitions = definitions;
		this.reductions = options?.reductions ?? [];
		this.msg = options?.report;
	}

	public report(msg: string): this {
		this.msg = msg;
		return this;
	}

	public createVisitor(config: AbsintVisitorConfiguration): AbstractInterpretationVisitor<AnyStateDomain> {
		const components: TaintComponent[] = this.definitions.map(def => ({
			name:   def.name,
			domain: def.domain,
			mapper: def.mapper,
		}));
		return new CompositeTaintInferenceVisitor(components, this.reductions, config);
	}
}
