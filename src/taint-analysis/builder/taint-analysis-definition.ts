import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { TaintMapper } from '../function-mapper';

export type TaintAnalysisName<Definition> = Definition extends TaintAnalysisDefinition<infer Name, infer _Domain> ? Name : never;
export type TaintAnalysisDomain<Definition> = Definition extends TaintAnalysisDefinition<infer _Name, infer Domain> ? Domain : never;

/**
 * Fluent builder class for defining new taint analyses.
 */
export class TaintAnalysisDefinition<Name extends string = string, Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	public readonly domain: Domain;
	public mapper:          TaintMapper<Domain> = [];
	public name:            Name;

	private _msg: string | undefined;

	get msg(): string | undefined {
		return this._msg;
	}

	constructor(name: Name, domain: Domain) {
		this.name = name;
		this.domain = domain;
	}

	public through(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping);
		return this;
	}

	public to(fnMapping: TaintMapper<Domain>): this {
		this.mapper.push(...fnMapping);
		return this;
	}

	public report(msg: string): this {
		this._msg = msg;
		return this;
	}
}