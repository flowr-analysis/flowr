import { bottomTopGuard } from '../general';
import type { Lift, Value, ValueSet } from '../r-value';

function flattenSetElements(s: Lift<Value[]>): Lift<Value[]> {
	return bottomTopGuard(s) ?? (s as Value[]).flatMap(e => {
		return e.type === 'set' ? flattenSetElements(e.elements) : e;
	});
}

export function setFrom<V extends Value[]>(...elements: V): ValueSet {
	return {
		type:     'set',
		elements: elements.flatMap(e => {
			return e.type === 'set' ? flattenSetElements(e.elements) : e;
		})
	};
}

