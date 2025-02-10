import { prepareParsedData, convertPreparedParsedData } from './format';
import { log } from '../../../../../util/log';
import type { IdGenerator, NormalizedAst } from '../../model/processing/decorate';
import { decorateAst , deterministicCountingIdGenerator } from '../../model/processing/decorate';
import type { NoInfo, RNode } from '../../model/model';
import { normalizeRootObjToAst } from '../main/internal/structure/normalize-root';
import type { NormalizerData } from '../main/normalizer-data';
import type { ParseStepOutputTS } from '../../../../../core/steps/all/core/01-parse-tree-sitter';
import { normalizeTreeSitterTreeToAst } from '../../../tree-sitter/tree-sitter-normalize';
import type { ParseStepOutput } from '../../../../parser';

export const parseLog = log.getSubLogger({ name: 'ast-parser' });

/**
 * Take the output as produced by the parse step and normalize the AST from the R parser.
 *
 * @see {@link normalizeButNotDecorated} for a version that does not decorate the AST
 * @see {@link normalizeTreeSitter} for a version that normalizes the AST from the TreeSitter parser
 */
export function normalize(
	parsed: ParseStepOutput<string>,
	getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0),
	file?: string
): NormalizedAst {
	return decorateAst(normalizeButNotDecorated(parsed), { getId, file });
}

/**
 * Take the output as produced by the parse step and normalize the AST from the R parser.
 * For additional decoration with ${@link decorateAst} use {@link normalize}.
 */
export function normalizeButNotDecorated(
	{ parsed }: ParseStepOutput<string>
): RNode {
	const data: NormalizerData = { currentRange: undefined, currentLexeme: undefined };
	const object = convertPreparedParsedData(prepareParsedData(parsed));

	return normalizeRootObjToAst(data, object);
}

/**
 * Tree-Sitter pendant to {@link normalize}.
 */
export function normalizeTreeSitter(
	{ parsed }: ParseStepOutputTS,
	getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0),
	file?: string
): NormalizedAst {
	const result = decorateAst(normalizeTreeSitterTreeToAst(parsed), { getId, file });
	result.hasError = parsed.rootNode.hasError;
	return result;
}
