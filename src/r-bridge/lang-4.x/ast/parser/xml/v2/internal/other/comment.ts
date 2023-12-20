import { XmlBasedJson } from '../../../common/input-format'
import { RComment, RType } from '../../../../../model'
import { retrieveMetaStructure } from '../../../common/meta'
import { NormalizeConfiguration } from '../../data'

/**
 * Normalize the given object as an R comment.
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - The normalizer config to use
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeComment(config: NormalizeConfiguration, obj: XmlBasedJson): RComment {
	const { location, content } = retrieveMetaStructure(config, obj)
	// we trust the parser here
	// guard(content.startsWith ('#'), 'comment must start with #')

	return {
		type:    RType.Comment,
		location,
		content: content.slice(1),
		lexeme:  content,
		info:    {}
	}
}
