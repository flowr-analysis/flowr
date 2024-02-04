import type { XmlBasedJson } from '../../../common/input-format'
import type { RComment, RLineDirective} from '../../../../../model'
import { RType } from '../../../../../model'
import { retrieveMetaStructure } from '../../../common/meta'
import type { NormalizeConfiguration } from '../../data'

const LineDirectiveRegex = /^#line\s+(\d+)\s+"([^"]+)"\s*$/

/**
 * Normalize the given object as an R line directive (`#line <number> "<file>"`).
 * This requires you to check the corresponding name beforehand.
 * If the given object turns out to be no line directive, this returns a normal comment instead.
 *
 * @param config - The normalizer config to use
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeLineDirective(config: NormalizeConfiguration, obj: XmlBasedJson): RLineDirective | RComment {
	const { location, content } = retrieveMetaStructure(config, obj)
	const match = LineDirectiveRegex.exec(content)
	if(match === null) {
		return {
			type:    RType.Comment,
			location,
			content: content.slice(1),
			lexeme:  content,
			info:    {}
		}
	} else {
		return {
			type:   RType.LineDirective,
			location,
			line:   parseInt(match[1]),
			file:   match[2],
			lexeme: content,
			info:   {}
		}
	}
}
