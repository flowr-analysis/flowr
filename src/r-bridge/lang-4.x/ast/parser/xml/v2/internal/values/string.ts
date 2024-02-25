import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import { string2ts } from '../../../../../../values'
import type { RString } from '../../../../../model'
import { RType } from '../../../../../model'
import { guard } from '../../../../../../../../util/assert'
import type { NormalizeConfiguration } from '../../data'

/**
 * Normalize the given object as a R string (see {@link string2ts}).
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - The configuration used by the normalizer
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeString(config: NormalizeConfiguration, obj: XmlBasedJson): RString {
	const { location, content } = retrieveMetaStructure(obj)

	// based on https://www.rdocumentation.org/packages/utils/versions/3.6.2/topics/getParseData we do not get strings with 1000 characters or more within the text field.
	// therefore, we recover the full string from the surrounding expr lexeme field
	let stringContent = content
	if(stringContent.startsWith('[')) { // something like "[9999 chars quoted with '"']"
		// ... as they are not stored by the R parser post-processor
		guard(config.currentLexeme !== undefined, 'need cur. lexeme for too long strings')
		stringContent = config.currentLexeme
	}

	return {
		type:    RType.String,
		location,
		content: string2ts(stringContent),
		lexeme:  stringContent,
		info:    {}
	}
}
