import { XmlBasedJson, XmlParseError } from '../../common/input-format'
import { getTokenType, retrieveMetaStructure } from '../../common/meta'
import { RType, RNode, RArgument, RawRType, RFunctionCall } from '../../../../model'
import { guard } from '../../../../../../../util/assert'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { NormalizeConfiguration } from '../data'
import { normalizeSingleToken } from './single-element'
import { tryToNormalizeArgument } from './functions/argument'
import {InternalScope} from "./internal";

/**
 * Normalize the given data as access (e.g., indexing).
 *
 * @param configuration - The data used by the parser (see {@link NormalizeConfiguration})
 * @param tokens        - The json object to extract the meta-information from
 * @param accessType    - The type of the access (e.g., `[[` or `$`)
 *
 * @returns The parsed {@link RAccess} or `undefined` if the given construct is not accessing a value
 */
export function normalizeAccess(configuration: NormalizeConfiguration, tokens: readonly XmlBasedJson[], accessType: RawRType): RFunctionCall {
	let closingLength = 0

	// TODO: shorthand combinations like `[<-` or `$<-`
	switch(accessType) {
		case RawRType.Dollar:
		case RawRType.At:
			break
		case RawRType.BracketLeft:
			closingLength = 1
			break
		case RawRType.DoubleBracketLeft:
			closingLength = 2
			break
		default:
			throw new XmlParseError(`expected second element to be an access operator, yet received ${accessType}`)
	}

	const first = getTokenType(configuration.tokenMap, tokens[0])
	guard(first === RawRType.Expression || first === RawRType.ExprOfAssignOrHelp,
		() => `expected accessed element to be wrapped an expression, yet received ${first}`)

	const parsedAccessed = normalizeSingleToken(configuration, tokens[0])
	const {
		content, location
	} = retrieveMetaStructure(configuration, tokens[1])

	// we can handle $ and @ directly
	if(closingLength === 0) {
		return {
			type:         RType.FunctionCall,
			location,
			lexeme:       content,
			info:         {},
			flavor:       'named',
			functionName: {
				type:      RType.Symbol,
				namespace: InternalScope,
				lexeme:    content,
				info:      {},
				content,
				location
			},
			arguments: [
				parsedAccessed,
				// normalize the symbol following
				normalizeSingleToken(configuration, tokens[2])
			],
		}
	}
	// otherwise we have to process
	const remaining: readonly XmlBasedJson[] = tokens.slice(2, tokens.length - closingLength)

	const splitAccessOnComma = splitArrayOn(remaining, elem => elem.name === RawRType.Comma)

	const parsedAccess: (RNode | undefined)[] = splitAccessOnComma.map((elems: readonly XmlBasedJson[]) =>
		elems.length === 0 ? undefined : normalizeAccessArgument(configuration, elems)
	)

	return {
		type:         RType.FunctionCall,
		location,
		lexeme:       content,
		info:         {},
		flavor:       'named',
		functionName: {
			type:      RType.Symbol,
			namespace: InternalScope,
			lexeme:    content,
			info:      {},
			content,
			location
		},
		arguments: [
			parsedAccessed,
			// normalize the symbol following
			...parsedAccess
		],
	}
}


function normalizeAccessArgument(config: NormalizeConfiguration, elements: readonly XmlBasedJson[]): RArgument {
	const res = tryToNormalizeArgument(config, elements)
	guard(res !== undefined, () => `expected one access result in access as argument, yet received ${JSON.stringify(res)} for ${JSON.stringify(elements)}`)
	return res
}
