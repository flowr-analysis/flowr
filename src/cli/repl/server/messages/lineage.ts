import type { SingleSlicingCriterion } from '../../../../slicing/criterion/parse'
import type { IdMessageBase, MessageDefinition } from './messages'
import type { NodeId } from '../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import Joi from 'joi'

export interface LineageRequestMessage extends IdMessageBase {
	type:      'request-lineage',
	/** The {@link FileAnalysisRequestMessage#filetoken} of the file/data */
	filetoken: string,
	/** The criterion to start the lineage from */
	criterion: SingleSlicingCriterion,
}

export const requestLineageMessage: MessageDefinition<LineageRequestMessage> = {
	type:   'request-lineage',
	schema: Joi.object({
		type:      Joi.string().valid('request-lineage').required(),
		id:        Joi.string().optional(),
		filetoken: Joi.string().required(),
		criterion: Joi.string().required()
	})
}

export interface LineageResponseMessage extends IdMessageBase {
	type:    'response-lineage',
	/** The lineage of the given criterion. With this being the representation of a set, there is no guarantee about order. */
	lineage: NodeId[]
}
