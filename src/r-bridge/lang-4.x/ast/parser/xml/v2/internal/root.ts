import type { NormalizeConfiguration } from '../data'
import type { XmlBasedJson } from '../../common/input-format'
import { getKeyGuarded } from '../../common/input-format'
import type { RExpressionList, RNode} from '../../../../model'
import { RawRType, RType } from '../../../../model'
import { normalizeExpression } from './expression'
import { normalizeLog } from '../normalize'

export function normalizeRoot(
	config: NormalizeConfiguration,
	obj: XmlBasedJson
): RExpressionList {
	const exprContent: XmlBasedJson = getKeyGuarded(obj, RawRType.ExpressionList)

	let normalized: RNode[] = []

	// the children of an expression list are an array of expressions
	if(config.children in exprContent) {
		const children: XmlBasedJson[] = getKeyGuarded(exprContent, config.children)
		normalized = normalizeExpression(config, children)
	} else {
		normalizeLog.debug('assume empty root')
	}

	return {
		type:     RType.ExpressionList,
		children: normalized,
		lexeme:   undefined,
		info:     {}
	}
}
