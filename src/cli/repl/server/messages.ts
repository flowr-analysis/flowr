/**
 * Provides the capability of connecting to the repl of flowr via messages.
 *
 * @module
 */
import { LAST_PER_FILE_STEP, LAST_STEP, StepResults } from '../../../core'
import { VersionInformation } from '../commands/version'
import { SlicingCriteria } from '../../../slicing'

export interface FlowrBaseMessage {
	type: string
}

export interface FlowrHelloResponseMessage extends FlowrBaseMessage{
	type:     'hello',
	versions: VersionInformation
}

export interface FlowrHelloErrorMessage extends FlowrBaseMessage {
	type:   'error',
	reason: string
}

export interface FileAnalysisRequestMessage extends FlowrBaseMessage {
	type:      'request-file-analysis',
	filetoken: string,
	filename:  string,
	content:   string
}

export interface SliceRequestMessage extends FlowrBaseMessage {
	type:      'request-slice',
	filetoken: string,
	criterion: SlicingCriteria
}

export type FlowrRequestMessage = FileAnalysisRequestMessage | SliceRequestMessage


interface BaseFileAnalysisResponseMessage extends FlowrBaseMessage {
	type:    'response-file-analysis',
	success: boolean,
}

interface FailedFileAnalysisResponseMessage extends BaseFileAnalysisResponseMessage {
	success: false,
}
interface SuccessfulFileAnalysisResponseMessage extends BaseFileAnalysisResponseMessage {
	success: true,
	results: StepResults<typeof LAST_PER_FILE_STEP>
}

export type FileAnalysisResponseMessage = FailedFileAnalysisResponseMessage | SuccessfulFileAnalysisResponseMessage

interface BaseSliceResponseMessage extends FlowrBaseMessage {
	type:    'response-slice',
	success: boolean,
}

interface FailedSliceResponseMessage extends BaseSliceResponseMessage {
	success: false
}

interface SuccessfulSliceResponseMessage extends BaseSliceResponseMessage {
	success: true,
	/** only contains the results of the slice steps to not repeat ourselves */
	results: Omit<StepResults<typeof LAST_STEP>, keyof StepResults<typeof LAST_PER_FILE_STEP>>
}

export type SliceResponseMessage = FailedSliceResponseMessage | SuccessfulSliceResponseMessage
