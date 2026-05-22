import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { FnTaintMapper } from '../function-mapper';

export type TaintAnalysisName<Definition> = Definition extends TaintAnalysisDefinition<infer Name, infer _Domain> ? Name : never;

/**
 * Fluent builder class for defining new taint analyses.
 */
export class TaintAnalysisDefinition<Name extends string, Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	public readonly domain: Domain;
	public mapper:          FnTaintMapper<Domain> = {};
	public name:            string;

	private msg: string | undefined;

	constructor(name: Name, domain: Domain) {
		this.name = name;
		this.domain = domain;
	}

	public through(fnMapping: FnTaintMapper<Domain>): this {
		this.mapper = { ...this.mapper, ...fnMapping };
		return this;
	}

	public to(fnMapping: FnTaintMapper<Domain>): this {
		this.mapper = { ...this.mapper, ...fnMapping };
		return this;
	}

	public report(msg: string): this {
		this.msg = msg;
		return this;
	}
}