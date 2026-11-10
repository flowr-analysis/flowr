import type { AbsintVisitorConfiguration } from '../../abstract-interpretation/absint-inference';
import { type TaintComponent, TaintInterpreter, type TaintProduct, type TaintVisitorConfiguration } from '../taint-visitor';
import { guard } from '../../util/assert';
import { StateAbstractDomain } from '../../abstract-interpretation/domains/state-abstract-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ProductReduction } from '../../abstract-interpretation/domains/partial-product-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { ReportTemplate } from './report-template';
import type { TaintFnCategory } from '../function-categories';
import { resolveCategoryToTaintMappings } from '../function-categories';
import type { TaintMapping, TaintConditionFunction } from '../taint-mapping';
import { TaintMapper, TaintRole  } from '../taint-mapping';

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
	readonly msg?: ReportTemplate;
	/** Creates the abstract interpreter that conducts the taint analysis for the given configuration. */
	createVisitor(config: TaintVisitorConfiguration, fnCategories?: TaintFnCategory[]): TaintInterpreter;
	/** The result state of `interpreter` (created by {@link createVisitor}) for this analysis. */
	resultState(interpreter: TaintInterpreter): StateAbstractDomain<AnyAbstractDomain>;
}

/** Options for composing multiple taint analyses into a {@link CompositeTaintAnalysisDefinition}. */
export interface ComposeOptions {
	/**
	 * Optional reductions turning the direct product into a reduced product.
	 * Each reduction may refine the inferred taints of the component analyses based on each other.
	 */
	reductions?: readonly ProductReduction<TaintProduct>[];
	/** The optional message reported when the composite analysis produces a finding. */
	report?:     ReportTemplate;
}

export interface TaintAnalysisReportStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisToStage<Name, Domain> {
	/** Set the message reported when the analysis produces a finding. */
	report(msg: ReportTemplate): TaintAnalysisDefinition<Name, Domain>;
}

export interface TaintAnalysisToStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisThroughStage<Name, Domain> {
	/** Add sink rules signaling findings by yielding Bottom. */
	to(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisReportStage<Name, Domain>;
}

export interface TaintAnalysisThroughStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> extends TaintAnalysisFromStage<Name, Domain> {
	/** Add propagator or sanitizer rules that determine the resulting taint of matching calls. */
	through(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisToStage<Name, Domain>;
}

export interface TaintAnalysisFromStage<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	/** Add propagator or sanitizer rules that determine the resulting taint of matching calls. */
	from(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisThroughStage<Name, Domain>;
	/** Add rules for function categories (i.e. sets of functions from {@link BuiltInIndex} fulfilling certain properties) */
	on(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>): TaintAnalysisFromStage<Name, Domain>;
	/** Shortcut when no transformers, sinks, and/or a report message should be defined */
	getPartialDefinition(): TaintAnalysisDefinition<Name, Domain>;
}

/**
 * Fluent builder class for defining new taint analyses.
 * Use {@link TaintAnalysisDefinition.create} to obtain an instance;
 * The methods {@link TaintAnalysis.from}, {@link TaintAnalysis.through},
 * {@link TaintAnalysis.to}, and {@link TaintAnalysis.report} have to be called in order.
 */
export class TaintAnalysisDefinition<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration> implements TaintAnalysisReportStage<Name, Domain> {
	public readonly domain: Domain;
	public mapper:          TaintMapper<Domain>;
	public categories:      TaintFnCategory[] = [];
	public name:            Name;
	public config:          Config | undefined;

	private _msg: ReportTemplate | undefined;

	get msg(): ReportTemplate | undefined {
		return this._msg;
	}

	private constructor(name: Name, domain: Domain, config?: Config) {
		this.name = name;
		this.domain = domain;
		this.config = config;
		this.mapper = new TaintMapper();
	}

	/**
	 * Create a new taint analysis builder. {@link run} is unreachable on the result until at least
	 * one of {@link add}, {@link addComposite}, or {@link addPredefined} has been called on it.
	 */
	public static create<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>(name: Name, domain: Domain, config?: Config): TaintAnalysisFromStage<Name, Domain> {
		return new TaintAnalysisDefinition(name, domain, config);
	}

	public on(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>) {
		guard(handler || category.handler, 'No handler set for given function category');
		this.categories.push({ ...category, handler: handler ?? category.handler });
		return this;
	}

	public from(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisThroughStage<Name, Domain> {
		this.mapper.pushMapping(fnMapping.map(m => ({ ...m, role: TaintRole.Source })));
		return this;
	}

	public through(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisToStage<Name, Domain> {
		this.mapper.pushMapping(fnMapping.map(m => ({ ...m, role: TaintRole.Transformer })));
		return this;
	}

	public to(...fnMapping: TaintMapping<Domain>[]): TaintAnalysisReportStage<Name, Domain> {
		this.mapper.pushMapping(fnMapping.map(m => ({ ...m, role: TaintRole.Sink })));
		return this;
	}

	public report(msg: ReportTemplate): this {
		this._msg = msg;
		return this;
	}

	public createVisitor(config: TaintVisitorConfiguration, fnCategories: TaintFnCategory[] = []): TaintInterpreter {
		const completeMapper = this.mapper.clone();

		// Add mappings from function categories.
		// Categories added to the individual analysis take precedence over passed categories.
		const finalFnCategories = [...this.categories, ...fnCategories];
		for(const category of finalFnCategories) {
			const resolved = resolveCategoryToTaintMappings<Domain>(category);
			completeMapper.pushMappingIfNotExists(resolved);
		}

		return new TaintInterpreter([{ name: this.name, domain: this.domain, mapper: completeMapper }], { ...this.config, ...config });
	}

	/** The end state of this single analysis, holding its own taint lattice values rather than a product of them. */
	public resultState(interpreter: TaintInterpreter): StateAbstractDomain<Domain> {
		const end = interpreter.getEndState();
		return end.isBottom()
			? StateAbstractDomain.bottom(this.domain, false)
			: new StateAbstractDomain(new Map(end.entries(this.name) as [NodeId, Domain][]), this.domain, false);
	}

	public getPartialDefinition(): this {
		return this;
	}

	/**
	 * Composes at least two taint analysis definitions into a single composite taint analysis.
	 * The component analyses are evaluated simultaneously during a single control-flow traversal and their taints are
	 * combined into a product of the lattice values per each CFG node (see {@link TaintInterpreter}).
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

	public msg: ReportTemplate | undefined;

	constructor(name: Name, definitions: readonly TaintAnalysisDefinition[], options?: ComposeOptions) {
		guard(definitions.length >= 2, 'A composite taint analysis must combine at least two taint analysis definitions');
		const names = definitions.map(def => def.name);
		guard(new Set(names).size === names.length, 'A composite taint analysis requires unique component analysis names');

		this.name = name;
		this.definitions = definitions;
		this.reductions = options?.reductions ?? [];
		this.msg = options?.report;
	}

	public report(msg: ReportTemplate): this {
		this.msg = msg;
		return this;
	}

	public createVisitor({ fnCallHook: _hook, ...config }: TaintVisitorConfiguration, _fnCategories?: TaintFnCategory[]): TaintInterpreter {
		const components: TaintComponent[] = this.definitions.map(def => ({
			name:   def.name,
			domain: def.domain,
			mapper: def.mapper,
		}));
		return new TaintInterpreter(components, config, this.reductions);
	}

	public resultState(interpreter: TaintInterpreter): StateAbstractDomain<AnyAbstractDomain> {
		return interpreter.getEndState();
	}
}
