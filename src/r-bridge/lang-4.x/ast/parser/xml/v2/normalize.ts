import { log } from '../../../../../../util/log'
import type {
	NormalizedAst,
	IdGenerator,
	NoInfo
} from '../../../model'
import {
	decorateAst,
	deterministicCountingIdGenerator
} from '../../../model'
import { normalizeRoot } from './internal/root'
import {prepareParsedData} from "../../json/format";
import {convertPreparedParsedData} from "../../json/parser";

export const normalizeLog = log.getSubLogger({ name: 'v2-normalize' })

/**
 * The main entry point to normalize the given R ast (using v2, which desugars the AST to function-calls only).
 *
 * @param jsonString - The json string obtained probably by {@link retrieveParseDataFromRCode} to normalization and desugar.
 * @param getId      - The function to be used to generate unique ids for the nodes of the ast. It is up to you to ensure that the ids are unique!
 *
 * @returns The normalized and decorated AST (i.e., as a doubly linked tree)
 */
export function normalize(jsonString: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const object = convertPreparedParsedData(prepareParsedData(jsonString))

	return decorateAst(normalizeRoot({ currentLexeme: undefined }, object), getId)
}

