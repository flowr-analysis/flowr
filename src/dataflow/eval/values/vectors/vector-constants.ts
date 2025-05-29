import type { Lift, Value, ValueVector } from '../r-value';
import { isValue , isBottom, isTop , Bottom , Top } from '../r-value';
import { bottomTopGuard } from '../general';
import { guard } from '../../../../util/assert';
import { binaryValue } from '../value-binary';


function inferVectorDomain(values: Lift<Value[]>): Value {
	let domain: Value | undefined = bottomTopGuard(values);
	if(domain) {
		return domain;
	}
	const elements = values as Value[];
	if(elements.length === 0) {
		return Top;
	}
	domain = elements[0];
	for(let i = 1; i < elements.length; i++) {
		domain = binaryValue(domain, 'union', elements[i]);
	}
	return domain;
}

export function vectorFrom<V extends Lift<Value[]>>({ elements, domain = inferVectorDomain(elements) }: { domain?: Value, elements: V}): ValueVector<V> {
	guard(isTop(elements) || isBottom(elements) || Array.isArray(elements), 'Expected array of values');
	return {
		type:          'vector',
		elements,
		elementDomain: domain
	};
}

// TODO: pull up sets
function flattenVectorElements(s: Lift<Value[]>): Lift<Value[]> {
	return bottomTopGuard(s) ?? (s as Value[]).flatMap(e => {
		return e.type === 'vector' ? flattenVectorElements(e.elements):
			e.type === 'set' && isValue(e.elements) && e.elements.length === 1 ?
				e.elements[0].type === 'vector' ? flattenVectorElements(e.elements[0].elements) : e.elements :
				e;
	});
}

export function flattenVector<V extends Value[]>(...elements: V): ValueVector {
	return vectorFrom({ elements: flattenVectorElements(elements) });
}


export const ValueEmptyVector = vectorFrom({ domain: Top, elements: [] });
export const ValueVectorTop: ValueVector<typeof Top> = {
	type:          'vector',
	elementDomain: Top,
	elements:      Top
};
export const ValueVectorBottom: ValueVector<typeof Bottom> = {
	type:          'vector',
	elementDomain: Bottom,
	elements:      Bottom
};
