import type { NormalizerData } from '../../normalizer-data';
import { tryNormalizeIfThen } from './normalize-if-then';
import { guard } from '../../../../../../../util/assert';
import { ensureExpressionList } from '../../normalize-meta';
import type { RIfThenElse } from '../../../../model/nodes/r-if-then-else';
import { normalizeSingleNode } from '../structure/normalize-single-node';
import { RawRType, RType } from '../../../../model/type';
import type { NamedJsonEntry } from '../../../json/format';

/**
 * Try to parse the construct as a {@link RIfThenElse}.
 */
export function tryNormalizeIfThenElse(
	data: NormalizerData,
	[ifT, lpT, cT, rpT, tT, eT, ebT]: [
		ifToken:    NamedJsonEntry,
		leftParen:  NamedJsonEntry,
		condition:  NamedJsonEntry,
		rightParen: NamedJsonEntry,
		then:       NamedJsonEntry,
		elseToken:  NamedJsonEntry,
		elseBlock:  NamedJsonEntry
	]): RIfThenElse | undefined {
	// we start by parsing a regular if-then structure
	const parsedIfThen = tryNormalizeIfThen(data, [ifT, lpT, cT, rpT, tT]);
	if(parsedIfThen === undefined) {
		return undefined;
	}

	guard(eT.name === RawRType.Else, () => `expected else token for if-then-else but found ${JSON.stringify(eT)}`);

	const parsedElse = normalizeSingleNode(data, ebT);
	guard(parsedElse.type !== RType.Delimiter, () => `unexpected missing else-part of if-then-else, received ${JSON.stringify([parsedIfThen, parsedElse])} for ${JSON.stringify([ifT, lpT, cT, rpT, tT, eT, ebT])}`);

	return {
		...parsedIfThen,
		otherwise: ensureExpressionList(parsedElse)
	};
}
