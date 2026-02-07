import { convertPreparedParsedData, prepareParsedData } from './format';
import { log } from '../../../../../util/log';
import { type IdGenerator, type NormalizedAst, decorateAst, deterministicCountingIdGenerator } from '../../model/processing/decorate';
import type { NoInfo } from '../../model/model';
import { normalizeRootObjToAst } from '../main/internal/structure/normalize-root';
import type { NormalizerData } from '../main/normalizer-data';
import { normalizeTreeSitterTreeToAst } from '../../../tree-sitter/tree-sitter-normalize';
import type { ParseStepOutput, ParseStepOutputSingleFile } from '../../../../parser';
import { type FlowrConfigOptions, getEngineConfig } from '../../../../../config';
import type { Tree } from 'web-tree-sitter';
import type { RProject } from '../../model/nodes/r-project';
import { mergeProjects } from '../../model/nodes/r-project';

export const parseLog = log.getSubLogger({ name: 'ast-parser' });

/**
 * Take the output as produced by the parse step and normalize the AST from the R parser.
 * @see {@link normalizeButNotDecorated} - for a version that does not decorate the AST
 * @see {@link normalizeTreeSitter}      - for a version that normalizes the AST from the TreeSitter parser
 */
export function normalize(
	parsed: ParseStepOutput<string>,
	getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)
): NormalizedAst {
	return decorateAst(mergeProjects(parsed.files.map(normalizeButNotDecorated)), { getId });
}

/**
 * Take the output as produced by the parse step and normalize the AST from the R parser.
 * For additional decoration with {@link decorateAst} use {@link normalize}.
 */
export function normalizeButNotDecorated(
	{ parsed, filePath }: ParseStepOutputSingleFile<string>
): RProject {
	const data: NormalizerData = { currentRange: undefined, currentLexeme: undefined };
	const object = convertPreparedParsedData(prepareParsedData(parsed));

	return normalizeRootObjToAst(data, object, filePath);
}

/**
 * Tree-Sitter pendant to {@link normalize}.
 */
export function normalizeTreeSitter(
	parsed: ParseStepOutput<Tree>,
	getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0),
	config: FlowrConfigOptions
): NormalizedAst {
	const lax = getEngineConfig(config, 'tree-sitter')?.lax;
	let now = Date.now();
	const nast = normalizeTreeSitterTreeToAst(parsed.files, lax);
	console.log(`Normalizing tree-sitter AST took ${Date.now() - now}ms.`);
	now = Date.now();
	const result = decorateAst(nast, { getId });
	console.log(`Decorating tree-sitter AST took ${Date.now() - now}ms.`);
	result.hasError = parsed.files.some(p => p.parsed.rootNode.hasError);
	return result;
}
