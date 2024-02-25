import type {
	NamedXmlBasedJson,
	XmlBasedJson } from '../../../common/input-format'
import {
	getKeyGuarded,
	XmlParseError
} from '../../../common/input-format'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import { guard } from '../../../../../../../../util/assert'
import type { NormalizeConfiguration } from '../../data'
import type { RComment, RFunctionCall, RNode, RSymbol } from '../../../../../model'
import { RawRType, RType } from '../../../../../model'
import { normalizeComment } from '../other'
import { normalizeSingleToken } from '../single-element'
import { splitComments } from '../../../v1/internal'
import { tryNormalizeSymbolNoNamespace } from '../values/symbol'
import {childrenKey} from "../../../input-format";

export function tryNormalizeFor(
	config: NormalizeConfiguration,
	forToken: XmlBasedJson,
	head: XmlBasedJson,
	body: XmlBasedJson
): RFunctionCall | undefined {

	// funny, for does not use top-level parenthesis
	if(getTokenType(forToken) !== RawRType.For) {
		return undefined
	} else if(getTokenType(head) !== RawRType.ForCondition) {
		throw new XmlParseError(`expected condition for for-loop but found ${JSON.stringify(head)}`)
	} else {
		const bodyName = getTokenType(body)
		if(bodyName !== RawRType.Expression && bodyName !== RawRType.ExprOfAssignOrHelp) {
			throw new XmlParseError(`expected expr body for for-loop but found ${JSON.stringify(body)}`)
		}
	}

	const newConfig: NormalizeConfiguration = { ...config, currentLexeme: undefined }

	const { variable: parsedVariable, vector: parsedVector, comments } = normalizeForHead(newConfig, head)
	const parseBody = normalizeSingleToken(newConfig, body)

	if(parsedVariable === undefined || parsedVector === undefined) {
		throw new XmlParseError(
			`unexpected under-sided for-loop, received ${JSON.stringify([
				parsedVariable,
				parsedVariable,
				parseBody,
			])}`
		)
	}

	const { location, content } = retrieveMetaStructure(forToken)

	return {
		type:         RType.FunctionCall,
		location,
		lexeme:       content,
		flavor:       'named',
		functionName: {
			type:      RType.Symbol,
			location,
			content,
			lexeme:    content,
			namespace: undefined,
			info:      {}
		},
		arguments: [parsedVariable, parsedVector, parseBody],
		info:      {
			additionalTokens: comments,
			fullLexeme:       config.currentLexeme
		}
	}
}

function normalizeForHead(config: NormalizeConfiguration, forCondition: XmlBasedJson): { variable: RSymbol | undefined, vector: RNode | undefined, comments: RComment[] } {
	// must have a child which is `in`, a variable on the left, and a vector on the right
	const children: NamedXmlBasedJson[] = getKeyGuarded<XmlBasedJson[]>(forCondition, childrenKey).map(content => ({
		name: getTokenType(content),
		content
	}))
	const { comments, others } = splitComments(children)

	const inPosition = others.findIndex(elem => elem.name === RawRType.ForIn)
	guard(inPosition > 0 && inPosition < others.length - 1, () => `for loop searched in and found at ${inPosition}, but this is not in legal bounds for ${JSON.stringify(children)}`)
	const variable = tryNormalizeSymbolNoNamespace(config, others[inPosition - 1].content)
	guard(variable !== undefined, () => `for loop variable should have been parsed to a symbol but was ${JSON.stringify(variable)}`)
	guard((variable as RNode).type === RType.Symbol, () => `for loop variable should have been parsed to a symbol but was ${JSON.stringify(variable)}`)

	const vector = normalizeSingleToken(config, others[inPosition + 1].content)
	const parsedComments = comments.map(c => normalizeComment(config, c.content))

	return { variable, vector: vector, comments: parsedComments }
}
