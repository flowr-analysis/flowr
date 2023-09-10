import { IdMessageBase, MessageDefinition } from './messages'
import { LAST_PER_FILE_STEP, StepResults } from '../../../../core'
import Joi from 'joi'

/**
 * Send by the client to request an analysis of a given file.
 * Answered by either an {@link FlowrErrorMessage} or a {@link FileAnalysisResponseMessage}.
 */
export interface FileAnalysisRequestMessage extends IdMessageBase {
	type:      'request-file-analysis',
	/**
	 * This is a unique token that you assign to subsequently slice the respective files.
	 * If you pass the same token multiple times, previous results will be overwritten.
	 */
	filetoken: string,
	/**
	 * A human-readable file name. If you present a `filepath` or read from a file this should be straightforward.
	 * However, the name is only for debugging and bears no semantic meaning.
	 */
	filename?: string,
	/** The contents of the file, or a R expression itself (like `1 + 1`), give either this or the `filepath`. */
	content?:  string
	/** The filepath on the local machine, accessible to flowR, or simply. Give either this or the `content` */
	filepath?: string
}


export const requestAnalysisMessage: MessageDefinition<FileAnalysisRequestMessage> = {
	type:   'request-file-analysis',
	schema: Joi.object({
		type:      Joi.string().valid('request-file-analysis').required(),
		id:        Joi.string().optional(),
		filetoken: Joi.string().required(),
		filename:  Joi.string().optional(),
		content:   Joi.string().optional(),
		filepath:  Joi.string().optional()
	}).xor('content', 'filepath')
}

/**
 * Answer for a successful {@link FileAnalysisRequestMessage}.
 * It contains the results of the analysis in JSON format.
 *
 * The `idMap` of the normalization step (see {@link NormalizedAst}) is not serialized as it would essentially
 * repeat the complete normalized AST.
 *
 * @note the serialization of maps and sets is controlled by the {@link jsonReplacer} as part of {@link sendMessage}.
 */
export interface FileAnalysisResponseMessage extends IdMessageBase {
	type:    'response-file-analysis',
	/**
	 * See the {@link SteppingSlicer} and {@link StepResults} for details on the results.
	 */
	results: StepResults<typeof LAST_PER_FILE_STEP>
}

