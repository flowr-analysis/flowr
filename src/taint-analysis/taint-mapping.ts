import type { AbstractDomain, AbstractValue, AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FunctionParameterLocation } from '../abstract-interpretation/data-frame/mappers/arguments';
import { Identifier } from '../dataflow/environments/identifier';

export class TaintMapper<Domain extends AnyAbstractDomain> {
	public mapper: TaintMappingInternal<Domain>[] = [];

	constructor(mapper?: TaintMappingInternal<Domain>[]) {
		if(mapper) {
			this.mapper = mapper;
		}
	}

	/**
	 * Add one or more taint mapping rules to the mapper
	 */
	public pushMapping(mappings: TaintMapping<Domain>[]) {
		this.mapper.push(...this.mapRulesToInternal(mappings));
	}

	/**
	 * Add one or more taint mapping rules to the mapper.
	 * If a mapping for the same function call and {@link TaintRole} already exists, it is skipped.
	 */
	public pushMappingIfNotExists(rules: TaintMapping<Domain>[]) {
		const internalRules = this.mapRulesToInternal(rules);
		for(const rule of internalRules) {
			if(this.hasMappingForRole(rule)) {
				continue;
			}
			this.mapper.push(rule);
		}
	}

	/**
	 * Get all mappings belonging to the given identifier
	 */
	public getMappings(identifier: Identifier) {
		const matchesCall = (id: Identifier) => Identifier.matches(id, identifier)
			|| (Identifier.getNamespace(identifier) === undefined && Identifier.matches(identifier, id));

		return this.mapper.filter(m => matchesCall(m.identifier));
	}

	/**
	 * Create a new, independent mapper containing the same taint mappings
	 */
	public clone(): TaintMapper<Domain> {
		return new TaintMapper<Domain>([...this.mapper]);
	}

	private hasMappingForRole(rule: TaintMappingInternal<Domain>): boolean {
		return this.getMappings(rule.identifier).some(i => i.role === rule.role);
	}

	private mapRulesToInternal(rules: TaintMapping<Domain>[]): TaintMappingInternal<Domain>[] {
		return rules.flatMap(r => this.mapRuleToInternal(r));
	}

	private mapRuleToInternal(rule: TaintMapping<Domain>): TaintMappingInternal<Domain>[] {
		if(Identifier.is(rule.identifier)) {
			return [rule as TaintMappingInternal<Domain>];
		}
		return rule.identifier.map(i => {
			return { role: rule.role, identifier: i,
				...('taint' in rule ? { taint: rule.taint } : { condition: rule.condition }) };
		});
	}
}

export enum TaintRole {
	Source = 'Source',
	Transformer = 'Transformer',
	Sink = 'Sink',
}

type TaintMappingBase = {
	readonly role?:      TaintRole;
	readonly identifier: Identifier | Identifier[];
};

/** A mapping that assigns a fixed taint to a matched call. */
export type TaintFixedMapping<Domain extends AnyAbstractDomain> = TaintMappingBase & {
	taint: AbstractValue<Domain>;
};

/** A mapping whose taint is computed from a {@link TaintCondition} over the call's argument values and taints. */
export type TaintConditionMapping<Domain extends AnyAbstractDomain> = TaintMappingBase & {
	condition: TaintCondition<Domain>;
};

/** Mapping of incoming function arguments and taints to a resulting taint */
export type TaintCondition<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	argValues?:  FunctionParameterLocation<unknown>[],
	argTaints?:  TaintParameterLocation[],
	conditionFn: TaintConditionFunction<Domain>
};

/**
 * A taint rule type used for the user-definition of taint analyses
 * Allows for mapping of one or multiple identifiers for convenience and conciseness.
 */
export type TaintMapping<Domain extends AnyAbstractDomain> =
	| TaintFixedMapping<Domain>
	| TaintConditionMapping<Domain>;

/**
 * Internal representation of a taint rule.
 * Each rule is mapped to a single identifier simplifying search and retrieval.
 */
type TaintMappingInternal<Domain extends AnyAbstractDomain> = {
	readonly role?:      TaintRole;
	readonly identifier: Identifier;
} & ({ taint: AbstractValue<Domain>; } | { condition: TaintCondition<Domain>; });

export type TaintConditionDomain<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Value, infer Top, infer Bot> ? AbstractDomain<Value, Top, Bot> : never;

/** Function describing how the resulting taint is calculated from incoming arguments and taints */
export type TaintConditionFunction<Domain extends AnyAbstractDomain> =
	( args: unknown[], taints: TaintConditionDomain<Domain>[]) => AbstractValue<Domain> | undefined;

export interface TaintParameterLocation {
	pos:   number,
	name?: string
}
