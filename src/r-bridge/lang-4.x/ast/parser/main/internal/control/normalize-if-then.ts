import { type NormalizerData, ParseError } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { ensureExpressionList, retrieveMetaStructure } from '../../normalize-meta';
import { RawRType, RType } from '../../../../model/type';
import type { RIfThenElse } from '../../../../model/nodes/r-if-then-else';
import { normalizeSingleNode } from '../structure/normalize-single-node';
import type { NamedJsonEntry } from '../../../json/format';


/**
 * Try to parse the construct as a {@link RIfThenElse}.
 */
export function tryNormalizeIfThen(
	data: NormalizerData,
	[ifT, lpT, cT, rpT, tT]: [
		ifToken:    NamedJsonEntry,
		leftParen:  NamedJsonEntry,
		condition:  NamedJsonEntry,
		rightParen: NamedJsonEntry,
		then:       NamedJsonEntry
	]): RIfThenElse | undefined {
	if(ifT.name !== RawRType.If) {
		parseLog.debug('encountered non-if token for supposed if-then structure');
		return undefined;
	} else if(lpT.name !== RawRType.ParenLeft) {
		throw new ParseError(`expected left-parenthesis for if but found ${JSON.stringify(lpT)}`);
	} else if(rpT.name !== RawRType.ParenRight) {
		throw new ParseError(`expected right-parenthesis for if but found ${JSON.stringify(rpT)}`);
	}

	const parsedCondition = normalizeSingleNode(data, cT);
	const parsedThen = normalizeSingleNode(data, tT);

	if(parsedCondition.type === RType.Delimiter || parsedThen.type === RType.Delimiter) {
		throw new ParseError(`unexpected missing parts of if, received ${JSON.stringify([parsedCondition, parsedThen])} for ${JSON.stringify([ifT, lpT, cT, rpT, tT])}`);
	}

	const { location, content } = retrieveMetaStructure(ifT.content);

	return {
		type:      RType.IfThenElse,
		condition: parsedCondition,
		then:      ensureExpressionList(parsedThen),
		location,
		lexeme:    content,
		info:      {
			fullRange:  data.currentRange,
			adToks:     [],
			fullLexeme: data.currentLexeme
		}
	};
}
