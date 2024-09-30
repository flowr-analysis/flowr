import type { IdMessageBase, MessageDefinition } from './all-messages';
import * as Joi from 'joi';
import type { SlicingCriteria } from '../../../../slicing/criterion/parse';
import type { PipelineOutput } from '../../../../core/steps/pipeline/pipeline';
import type { DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICING_PIPELINE } from '../../../../core/steps/pipeline/default-pipelines';

/**
 * Can only be sent after you have sent the {@link FileAnalysisRequestMessage}.
 * Using the same `filetoken` as in the {@link FileAnalysisRequestMessage} you
 * can slice the respective file given the respective criteria.
 */
export interface SliceRequestMessage extends IdMessageBase {
	type:             'request-slice',
	/** The {@link FileAnalysisRequestMessage#filetoken} of the file/data to slice */
	filetoken:        string,
	/** The slicing criteria to use */
	criterion:        SlicingCriteria,
	/**
	 * Should the magic comments (force-including lines within the slice) be ignord?
	 */
	noMagicComments?: boolean
}

export const requestSliceMessage: MessageDefinition<SliceRequestMessage> = {
	type:   'request-slice',
	schema: Joi.object({
		type:      Joi.string().valid('request-slice').required().description('The type of the message.'),
		id:        Joi.string().optional().description('The id of the message, if you passed one in the request.'),
		filetoken: Joi.string().required().description('The filetoken of the file to slice must be the same as with the analysis request.'),
		criterion: Joi.array().items(Joi.string()).min(0).required().required().description('The slicing criteria to use.'),
	})
};


/**
 * Similar to {@link FileAnalysisResponseMessage} this only contains the results of
 * the slice steps.
 */
export interface SliceResponseMessage extends IdMessageBase {
	type:    'response-slice',
	/** only contains the results of the slice steps to not repeat ourselves */
	results: Omit<PipelineOutput<typeof DEFAULT_SLICING_PIPELINE>, keyof PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>>
}

export const responseSliceMessage: MessageDefinition<SliceResponseMessage> = {
	type:   'response-slice',
	schema: Joi.object({
		type:    Joi.string().valid('response-slice').required().description('The type of the message.'),
		id:      Joi.string().optional().description('The id of the message, if you passed one in the request.'),
		results: Joi.object().required().description('The results of the slice (one field per step slicing step).')
	}).description('The response to a slice request.')
};
