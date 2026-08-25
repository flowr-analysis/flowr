import type { TaintMapper, TaintMapping, TaintRole } from '../function-mapper';
import type {
	AbsintVisitorConfiguration,
	AbstractInterpretationVisitor
} from '../../abstract-interpretation/absint-visitor';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';
import type { TaintComponent, TaintProduct } from '../composite-taint-visitor';
import { CompositeTaintInferenceVisitor } from '../composite-taint-visitor';
import type { TaintVisitorConfiguration } from '../taint-visitor';
import { TaintInferenceVisitor } from '../taint-visitor';
import { guard } from '../../util/assert';
import type { ProductReduction } from '../../abstract-interpretation/domains/partial-product-domain';
import type { AbstractValue, AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { AbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import type { ArgProps } from '../../dataflow/environments/built-in-props';
import { ArgProp } from '../../dataflow/environments/built-in-props';
import { Identifier } from '../../dataflow/environments/identifier';

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
 * A singular taint analysis definition or a combination of multiple taint analyses
 * creatable via {@link TaintAnalysisDefinition.compose}.
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

	/** Adds default propagators (i.e. pure functions for which we know that the return value is based on at least one argument) */
	public withDefaultPropagators(argProps: ArgProps = ArgProp.Alias | ArgProp.Value | ArgProp.Shape): this {
		const idx = BuiltInIndex.default();
		for(const i of idx.pure) {
			const sig = idx.entries.find(e => Identifier.matches(i, e.name))?.sig;
			if(!sig){
				continue;
			}

			const containingArgProp = sig.filter(([_name, arg]) => (arg & argProps) !== 0);
			const arg = containingArgProp.map(([name], idx) => {
				return { pos: idx, name: name };
			});

			const handler: TaintMapping<Domain> = {
				identifier: i,
				role:       'through',
				condition:  {
					argTaints: arg,
					condition: (_, taints) => {
						const taintDomains = taints.map(t => this.domain.create(t));
						return AbstractDomain.joinAll(taintDomains).value as AbstractValue<Domain>;
					}
				},
			};

			this.mapper.push(handler);
		}

		return this;
	}

	/** Adds source rules that determine the resulting taint of matching calls. */
	public from(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'from' as TaintRole })));
		return this;
	}

	/** Adds propagator or sanitizer rules that determine the resulting taint of matching calls. */
	public through(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'through' as TaintRole })));
		return this;
	}

	/** Adds sink rules whose conditions check argument taints and signal findings by yielding Bottom. */
	public to(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping.map(m => ({ ...m, role: 'to' as TaintRole })));
		return this;
	}

	/** A human-readable message displayed when a finding occurred. */
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
