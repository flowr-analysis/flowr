import type { TaintMapper, TaintMapping } from '../function-mapper';
import type { AbsintVisitorConfiguration, AbstractInterpretationVisitor } from '../../abstract-interpretation/absint-visitor';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';
import type { TaintComponent, TaintProduct } from '../composite-taint-visitor';
import { CompositeTaintInferenceVisitor } from '../composite-taint-visitor';
import type { TaintVisitorConfiguration } from '../taint-visitor';
import { TaintInferenceVisitor } from '../taint-visitor';
import { guard } from '../../util/assert';
import type { ProductReduction } from '../../abstract-interpretation/domains/partial-product-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';

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

/**
 * Fluent builder class for defining new taint analyses.
 */
export class TaintAnalysisDefinition<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
implements RunnableTaintAnalysisDefinition<Name> {
	public readonly domain: Domain;
	public mapper:          TaintMapper<Domain> = [];
	public name:            Name;
	public config:          Config | undefined;

	private _msg: string | undefined;

	get msg(): string | undefined {
		return this._msg;
	}

	constructor(name: Name, domain: Domain, config?: Config) {
		this.name = name;
		this.domain = domain;
		this.config = config;
	}

	/** Adds source rules that determine the resulting taint of matching calls. */
	public from(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'from' } as TaintMapping<Domain>)));
		return this;
	}

	/** Adds propagator or sanitizer rules that determine the resulting taint of matching calls. */
	public through(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'through' } as TaintMapping<Domain>)));
		return this;
	}

	/** Adds sink rules whose conditions check argument taints and signal findings by yielding Bottom. */
	public to(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'to' } as TaintMapping<Domain>)));
		return this;
	}

	public report(msg: string): this {
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
		definitions: readonly TaintAnalysisDefinition<string>[],
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
