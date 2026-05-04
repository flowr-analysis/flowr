import type { FlowrAnalyzer } from '../project/flowr-analyzer';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FnTaintMapper } from './function-mapper';
import { TaintInferenceVisitor } from './taint-visitor';
import { guard } from '../util/assert';

export class TaintAnalysis<Domain extends AnyAbstractDomain> {
	private readonly domain:   Domain;
	private readonly analyzer: FlowrAnalyzer;
	private mapper:            FnTaintMapper<Domain> = {};
	private msg:               string | undefined;

	constructor(domain: Domain, analyzer: FlowrAnalyzer) {
		this.domain = domain;
		this.analyzer = analyzer;
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

	public async run() {
		guard(this.mapper !== undefined, 'No function mapping set. Please call the method through before running the analysis');

		const visitor = new TaintInferenceVisitor(this.domain, this.mapper, {
			controlFlow:   await this.analyzer.controlflow(),
			ctx:           this.analyzer.inspectContext(),
			dfg:           (await this.analyzer.dataflow()).graph,
			normalizedAst: await this.analyzer.normalize()
		});
		visitor.start();
		return visitor.getEndState();
	}
}