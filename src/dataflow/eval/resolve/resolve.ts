import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { guard } from '../../../util/assert';
import { BuiltInEvalHandlerMapper } from '../../environments/built-in';
import type { REnvironmentInformation } from '../../environments/environment';
import { intervalFrom } from '../values/intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import type { Value } from '../values/r-value';
import { isTop, Top } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import { resolveIdToValue } from './alias-tracking';

export function resolveNode(a: RNodeWithParent, env?: REnvironmentInformation, map?: AstIdMap): Value {
	if(a.type === RType.String) {
		return stringFrom(a.content.str);
	} else if(a.type === RType.Number) {
		return intervalFrom(a.content.num, a.content.num);	
	} else if(a.type === RType.Logical) {
		return a.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(a.type === RType.FunctionCall && env) {
		if(a.lexeme in BuiltInEvalHandlerMapper) {
			const handler = BuiltInEvalHandlerMapper[a.lexeme as keyof typeof BuiltInEvalHandlerMapper];
			return handler(a, env, map);
		}
	}
	return Top;
}

export function resolveAsVector(a: RNodeWithParent, env: REnvironmentInformation, map?: AstIdMap): Value {
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
			const value = resolveIdToValue(arg.info.id, { environment: env, idMap: map, full: true });
			if(isTop(value)) {
				return Top;
			}

			values.push(value);
		} else {
			const val = resolveNode(arg.value, env, map);
			if(isTop(val)) {
				return Top;
			}
	
			values.push(val);
		}

	}

	return vectorFrom(flattenVectorElements(values));
}