import type { IdMessageBase, MessageDefinition } from './messages';
import Joi from 'joi';
import type { ControlFlowInformation } from '../../../../util/cfg/cfg';
import type { DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICING_PIPELINE } from '../../../../core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../core/steps/pipeline/pipeline';

/**
 * Send by the client to request an analysis of a given file.
 * Answered by either an {@link FlowrErrorMessage} or a {@link FileAnalysisResponseMessageJson}.
 */
export interface FileAnalysisRequestMessage extends IdMessageBase {
	type:       'request-file-analysis',
	/**
	 * This is a unique token that you assign to subsequently slice the respective files.
	 * If you pass the same token multiple times, previous results will be overwritten.
	 *
	 * If you do _not_ pass a file token, the server will _not_ store the results!
	 */
	filetoken?: string,
	/**
	 * A human-readable file name. If you present a `filepath` or read from a file this should be straightforward.
	 * However, the name is only for debugging and bears no semantic meaning.
	 */
	filename?:  string,
	/**
	 * The contents of the file, or an R expression itself (like `1 + 1`), give either this or the `filepath`.
	 * If you want to load multiple R files as one, either use `filepath` or concatenate the file-contents for this field.
	 */
	content?:   string
	/**
	 * The filepath on the local machine, accessible to flowR, or simply. Give either this or the `content`.
	 * If you want to load multiple R files as one, either use this or concatenate the file-contents for the `content`.
	 */
	filepath?:  string | readonly string[]
	/** Can be used to additionally extract the {@link ControlFlowInformation} of the file, which is not exposed (and not fully calculated) by default. */
	cfg?:       boolean
	/** Controls the serialization of the `results` (and the {@link ControlFlowGraph} if the corresponding flag is set). If missing, we assume _json_. */
	format?:    'json' | 'n-quads'
}


export const requestAnalysisMessage: MessageDefinition<FileAnalysisRequestMessage> = {
	type:   'request-file-analysis',
	schema: Joi.object({
		type:      Joi.string().valid('request-file-analysis').required().description('The type of the message.'),
		id:        Joi.string().optional().description('You may pass an id to link requests with responses (they get the same id).'),
		filetoken: Joi.string().optional().description('A unique token to identify the file for subsequent requests. Only use this if you plan to send more queries!'),
		filename:  Joi.string().optional().description('A human-readable name of the file, only for debugging purposes.'),
		content:   Joi.string().optional().description('The content of the file or an R expression (either give this or the filepath).'),
		filepath:  Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).optional().description('The path to the file(s) on the local machine (either give this or the content).'),
		cfg:       Joi.boolean().optional().description('If you want to extract the control flow information of the file.'),
		format:    Joi.string().valid('json', 'n-quads').optional().description('The format of the results, if missing we assume json.')
	}).xor('content', 'filepath')
};

/**
 * Answer for a successful {@link FileAnalysisRequestMessage}.
 * It contains the results of the analysis in JSON format (guided by {@link FileAnalysisRequestMessage#format}).
 *
 * The `idMap` of the normalization step (see {@link NormalizedAst}) is not serialized as it would essentially
 * repeat the complete normalized AST, you have to re-create it yourself if you require it.
 *
 * @note The serialization of maps and sets is controlled by the {@link jsonReplacer} as part of {@link sendMessage}.
 *
 * @see FileAnalysisResponseMessageNQuads
 */
export interface FileAnalysisResponseMessageJson extends IdMessageBase {
	type:    'response-file-analysis',
	format:  'json',
	/**
	 * See the {@link SteppingSlicer} and {@link StepResults} for details on the results.
	 */
	results: PipelineOutput<typeof DEFAULT_SLICING_PIPELINE>
	/**
	 * Only if the {@link FileAnalysisRequestMessage} contained a `cfg: true` this will contain the {@link ControlFlowInformation} of the file.
	 */
	cfg?:    ControlFlowInformation
}

const jsonSchema = Joi.object({
	type:    Joi.string().valid('response-file-analysis').required().description('The type of the message.'),
	id:      Joi.string().optional().description('The id of the message, if you passed one in the request.'),
	format:  Joi.string().valid('json').required().description('The format of the results in json format.'),
	results: Joi.object().required().description('The results of the analysis (one field per step).'),
	cfg:     Joi.object().optional().description('The control flow information of the file, only present if requested.')
}).description('The response in JSON format.');

/**
 * Similar to {@link FileAnalysisResponseMessageJson} but using n-quads as serialization format.
 */
export interface FileAnalysisResponseMessageNQuads extends IdMessageBase {
	type:    'response-file-analysis',
	format:  'n-quads',
	/**
	 * @see FileAnalysisResponseMessageJson#results
	 */
	results: {
		[K in keyof PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]: string
	}
	/**
	 * @see FileAnalysisResponseMessageJson#cfg
	 */
	cfg?: string
}

const nquadsSchema = Joi.object({
	type:    Joi.string().valid('response-file-analysis').required().description('The type of the message.'),
	id:      Joi.string().optional().description('The id of the message, if you passed one in the request.'),
	format:  Joi.string().valid('n-quads').required().description('The format of the results in n-quads format.'),
	results: Joi.object().required().description('The results of the analysis (one field per step). Quads are presented as string.'),
	cfg:     Joi.string().optional().description('The control flow information of the file, only present if requested.')
}).description('The response as n-quads.');

export const analysisResponseMessage: MessageDefinition<FileAnalysisResponseMessageJson | FileAnalysisResponseMessageNQuads> = {
	type:   'response-file-analysis',
	schema: Joi.alternatives(
		jsonSchema,
		nquadsSchema
	).required().description('The response to a file analysis request (based on the `format` field).')
};
