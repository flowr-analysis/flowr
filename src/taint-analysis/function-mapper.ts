import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../dataflow/environments/identifier';
import type { AbstractDomainValue, AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';

/**
 *
 */
export function mapFnCallToTaint<Domain extends AnyAbstractDomain>(
	node: RNode<ParentInformation>,
	mapper: FnTaintMapper<Domain>
): AbstractDomainValue<Domain> | undefined {

	if(node.type !== RType.FunctionCall || !node.named) {
		return;
	}

	const functionName = Identifier.getName(node.functionName.content);

	if(mapper[functionName]) {
		return mapper[functionName].taint;
	}

	return undefined;
}

export interface FnTaintMapperInfo<TaintDomain extends AnyAbstractDomain> {
	/** Mapper function mapping the function call with the given arguments to abstract operations */
	readonly taint: AbstractDomainValue<TaintDomain>;
}

export type FnTaintMapper<TaintDomain extends AnyAbstractDomain> = Record<string, FnTaintMapperInfo<TaintDomain>>;