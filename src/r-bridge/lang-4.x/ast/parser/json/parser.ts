import { prepareParsedData, convertPreparedParsedData } from './format';
import { log } from '../../../../../util/log';
import type { IdGenerator, NormalizedAst } from '../../model/processing/decorate';
import { decorateAst , deterministicCountingIdGenerator } from '../../model/processing/decorate';
import type { NoInfo } from '../../model/model';
import { normalizeRootObjToAst } from '../main/internal/structure/normalize-root';
import type { NormalizerData } from '../main/normalizer-data';
import type { ParseStepOutput } from '../../../../../core/steps/all/core/00-parse';

export const parseLog = log.getSubLogger({ name: 'ast-parser' });

/**
 * Take the output as produced by the parse step and normalize the AST from the R parser.
 */
export function normalize(
	{ parsed }: ParseStepOutput,
	getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0),
	file: string | undefined
): NormalizedAst {
	const data: NormalizerData = { currentRange: undefined, currentLexeme: undefined };
	const object = convertPreparedParsedData(prepareParsedData(parsed));

	return decorateAst(normalizeRootObjToAst(data, object), { getId, file });
}
