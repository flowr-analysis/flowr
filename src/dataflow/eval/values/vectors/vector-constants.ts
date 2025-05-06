import type { Lift, Value, ValueVector } from '../r-value';
import { isBottom, isTop , Top } from '../r-value';
import { guard } from '../../../../util/assert';
import type { RNodeWithParent } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { valueFromRNode } from '../general';


export function vectorFrom<V extends Lift<Value[]>>(elements: V): ValueVector<V> {
	guard(isTop(elements) || isBottom(elements) || Array.isArray(elements), 'Expected array of values');
	return {
		type:          'vector',
		elements,
		elementDomain: Top
	};
}

export function vectorFromRNode(a: RNodeWithParent): Value {
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

		const val = valueFromRNode(arg.value);
		if(isTop(val)) {
			return Top;
		}

		values.push(val);
	}

	return vectorFrom(values);
}