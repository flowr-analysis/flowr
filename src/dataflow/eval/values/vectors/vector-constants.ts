import type { Lift, Value, ValueVector } from '../r-value';
import { isBottom, isTop , isValue, Top } from '../r-value';
import { guard } from '../../../../util/assert';
import type { AstIdMap, RNodeWithParent } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { bottomTopGuard, valueFromRNode } from '../general';
import { resolveValueOfVariable } from '../../../environments/resolve-by-name';
import type { REnvironmentInformation } from '../../../environments/environment';


export function vectorFrom<V extends Lift<Value[]>>(elements: V): ValueVector<V> {
	guard(isTop(elements) || isBottom(elements) || Array.isArray(elements), 'Expected array of values');
	return {
		type:          'vector',
		elements,
		elementDomain: Top
	};
}


function flatten(v: ValueVector): Lift<ValueVector> {
	if(!isValue(v)) {
		return v;
	}

	const elements: Value[] = [];
	if(!isValue(v.elements)) {
		return v.elements;
	}

	for(const entry of v.elements) {
		if(!isValue(entry)) {
			return entry;
		}

		if(entry.type === 'vector') {
			const inner = flatten(entry);
			if(!isValue(inner)) {
				return inner;
			}

			if(!isValue(inner.elements)) {
				return inner.elements;
			}

			const containsBT = bottomTopGuard(inner.elements);
			if(containsBT) {
				return containsBT;
			}

			elements.push(...inner.elements);
		} else if(entry.type === 'set') {
			if(!isValue(entry.elements)) {
				return entry.elements;
			}

			const containsBT = bottomTopGuard(entry.elements);
			if(containsBT) {
				return containsBT;
			}

			if(entry.elements.length === 1) {
				if(!isValue(entry.elements[0])) {
					return entry.elements[0];
				}
				
				elements.push(entry.elements[0]);
			} else {
				elements.push(entry);
			}
		} else {
			elements.push(entry);
		}
	}

	return {
		type:          'vector',
		elementDomain: v.elementDomain,
		elements:      elements
	};
}

export function vectorFromRNode(a: RNodeWithParent, env: REnvironmentInformation, map?: AstIdMap): Value {
	guard(a.type === RType.FunctionCall);
	guard(a.lexeme == 'c', 'can only create vector from c function');
	
	const values: Value[] = [];
	for(const arg of a.arguments) {
		if(arg === EmptyArgument) {
			continue;
		}
		
		if(arg.value === undefined) {
			return Top;
		}


		if(arg.value.type === RType.Symbol) {
			const value = resolveValueOfVariable(arg.lexeme, env, map);
			if(isTop(value)) {
				return Top;
			}

			values.push(value);
		} else {
			const val = valueFromRNode(arg.value, env, map);
			if(isTop(val)) {
				return Top;
			}
	
			values.push(val);
		}

	}

	return flatten(vectorFrom(values));
}