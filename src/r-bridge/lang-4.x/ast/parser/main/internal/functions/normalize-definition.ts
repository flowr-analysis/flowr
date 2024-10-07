import type { NormalizerData } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { ensureExpressionList, retrieveMetaStructure } from '../../normalize-meta';
import { guard, isNotUndefined } from '../../../../../../../util/assert';
import { splitArrayOn } from '../../../../../../../util/arrays';
import { tryNormalizeParameter } from './normalize-parameter';
import type { RFunctionDefinition } from '../../../../model/nodes/r-function-definition';
import { RawRType, RType } from '../../../../model/type';
import type { RParameter } from '../../../../model/nodes/r-parameter';
import { normalizeExpressions } from '../structure/normalize-expressions';
import type { NamedJsonEntry } from '../../../json/format';

/**
 * Tries to parse the given data as a function definition.
 *
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param mappedWithName - The JSON object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionDefinition} or `undefined` if the given construct is not a function definition
 */
export function tryNormalizeFunctionDefinition(data: NormalizerData, mappedWithName: readonly NamedJsonEntry[]): RFunctionDefinition | undefined {
	const fnBase = mappedWithName[0];
	if(fnBase.name !== RawRType.Function && fnBase.name !== RawRType.Lambda) {
		parseLog.trace(`expected function definition to be identified by keyword, yet received ${fnBase.name}`);
		return undefined;
	}

	const { content, location } = retrieveMetaStructure(fnBase.content);

	const openParen = mappedWithName[1];
	guard(openParen.name === RawRType.ParenLeft, () => `expected opening parenthesis, yet received ${openParen.name}`);

	const closingParenIndex = mappedWithName.findIndex(x => x.name === RawRType.ParenRight);
	guard(closingParenIndex !== -1, () => `expected closing parenthesis, yet received ${JSON.stringify(mappedWithName)}`);

	const splitParameters = splitArrayOn(mappedWithName.slice(2, closingParenIndex), x => x.name === RawRType.Comma);

	const parameters: (undefined | RParameter)[] = splitParameters.map(x => tryNormalizeParameter(data, x));

	if(parameters.some(p => p === undefined)) {
		parseLog.error(`function had unexpected unknown parameters: ${JSON.stringify(parameters.filter(isNotUndefined))}, aborting.`);
		return undefined;
	}

	const bodyStructure = mappedWithName.slice(closingParenIndex + 1);
	guard(bodyStructure.length === 1, () => `expected function body to be unique, yet received ${bodyStructure.length}`);

	const body = normalizeExpressions(data, bodyStructure);
	guard(body.length === 1 && body[0].type !== RType.Delimiter, () => `expected function body to yield one normalized expression, but ${body.length}`);


	return {
		type:       RType.FunctionDefinition,
		location,
		lexeme:     content,
		parameters: parameters as RParameter[],
		body:       ensureExpressionList(body[0]),
		info:       {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	};
}
