import type { SourceRange } from '../../../src/util/range';
import type { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../src/r-bridge/lang-4.x/convert-values';
import type { RParameter } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-parameter';

const emptyInfo = { fullRange: undefined, adToks: [], fullLexeme: undefined, nest: 0 };


/**
 * An expression list holding `children`, with no location and no lexeme, as a test expectation wants it.
 * @param children - what the list holds
 */
export function exprList(...children: RNode[]): RExpressionList {
	return { type: RType.ExpressionList, children, lexeme: undefined, info: emptyInfo, grouping: undefined, location: undefined };
}

/**
 * An R number value.
 * @param value         - the number itself
 * @param markedAsInt   - whether the source wrote it as `1L`
 * @param complexNumber - whether the source wrote it as `1i`
 */
export function numVal(value: number, markedAsInt = false, complexNumber = false): RNumberValue {
	return { num: value, markedAsInt, complexNumber };
}


/**
 * A function parameter.
 * @param name         - the parameter's name
 * @param location     - where the name is written
 * @param defaultValue - what it falls back to, absent for a parameter without one
 * @param special      - whether this is the `...` parameter
 */
export function parameter(name: string, location: SourceRange, defaultValue?: RNode, special = false): RParameter {
	return {
		type:   RType.Parameter,
		location,
		special,
		lexeme: name,
		defaultValue,
		name:   {
			type:    RType.Symbol,
			location,
			lexeme:  name,
			content: name,
			info:    emptyInfo
		},
		info: emptyInfo
	};
}
