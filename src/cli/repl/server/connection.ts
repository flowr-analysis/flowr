import { sendMessage } from './send';
import { answerForValidationError, validateBaseMessageFormat, validateMessage } from './validate';
import type {
	FileAnalysisRequestMessage,
	FileAnalysisResponseMessageCompact,
	FileAnalysisResponseMessageNQuads
} from './messages/message-analysis';
import { requestAnalysisMessage } from './messages/message-analysis';
import type { SliceRequestMessage, SliceResponseMessage } from './messages/message-slice';
import { requestSliceMessage } from './messages/message-slice';
import type { FlowrErrorMessage } from './messages/message-error';
import type { Socket } from './net';
import { serverLog } from './server';
import type { ILogObj, Logger } from 'tslog';
import type {
	ExecuteEndMessage,
	ExecuteIntermediateResponseMessage,
	ExecuteRequestMessage
} from './messages/message-repl';
import { requestExecuteReplExpressionMessage } from './messages/message-repl';
import { replProcessAnswer } from '../core';
import { LogLevel } from '../../../util/log';
import { cfg2quads } from '../../../control-flow/extract-cfg';
import type { QuadSerializationConfiguration } from '../../../util/quads';
import { defaultQuadIdGenerator } from '../../../util/quads';
import { printStepResult, StepOutputFormat } from '../../../core/print/print';
import { PARSE_WITH_R_SHELL_STEP } from '../../../core/steps/all/core/00-parse';
import { NORMALIZE } from '../../../core/steps/all/core/10-normalize';
import { STATIC_DATAFLOW } from '../../../core/steps/all/core/20-dataflow';
import { ansiFormatter, voidFormatter } from '../../../util/text/ansi';
import { DEFAULT_SLICING_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type { DeepPartial } from 'ts-essentials';
import { DataflowGraph } from '../../../dataflow/graph/graph';
import * as tmp from 'tmp';
import fs from 'fs';
import type { RParseRequests } from '../../../r-bridge/retriever';
import type { LineageRequestMessage, LineageResponseMessage } from './messages/message-lineage';
import { requestLineageMessage } from './messages/message-lineage';
import { getLineage } from '../commands/repl-lineage';
import type { QueryRequestMessage, QueryResponseMessage } from './messages/message-query';
import { requestQueryMessage } from './messages/message-query';
import type { KnownParser, ParseStepOutput } from '../../../r-bridge/parser';
import { compact } from './compact';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import type { FlowrConfigOptions } from '../../../config';
import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';
import { FlowrAnalyzerBuilder } from '../../../project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../project/flowr-analyzer';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { PipelineStepStage } from '../../../core/steps/pipeline-step';

/**
 * Each connection handles a single client, answering to its requests.
 * There is no need to construct this class manually, {@link FlowRServer} will do it for you.
 */
export class FlowRServerConnection {
	private readonly socket:              Socket;
	private readonly parser:              KnownParser;
	private readonly name:                string;
	private readonly logger:              Logger<ILogObj>;
	private readonly allowRSessionAccess: boolean;
	private readonly config:              FlowrConfigOptions;

	// maps token to information
	private readonly fileMap = new Map<string, {
		filename?: string,
		analyzer:  FlowrAnalyzer
	}>();

	// we do not have to ensure synchronized shell-access as we are always running synchronized
	constructor(socket: Socket, name: string, parser: KnownParser, allowRSessionAccess: boolean, config: FlowrConfigOptions) {
		this.config = config;
		this.socket = socket;
		this.parser = parser;
		this.name = name;
		this.logger = serverLog.getSubLogger({ name });
		this.socket.on('data', data => this.handleData(String(data)));
		this.socket.on('error', e => this.logger.error(`[${this.name}] Error while handling connection: ${String(e)}`));
		this.socket.on('close', () => {
			this.fileMap.clear();
		});
		this.allowRSessionAccess = allowRSessionAccess;
	}

	private currentMessageBuffer = '';
	private handleData(message: string) {
		if(!message.endsWith('\n')) {
			this.currentMessageBuffer += message;
			this.logger.trace(`[${this.name}] Received partial message. Buffering ${this.currentMessageBuffer.length}.`);
			return;
		}
		message = this.currentMessageBuffer + message;
		if(this.logger.settings.minLevel >= LogLevel.Debug) {
			this.logger.debug(`[${this.name}] Received message: ${message}`);
		}

		this.currentMessageBuffer = '';
		const request = validateBaseMessageFormat(message);
		if(request.type === 'error') {
			answerForValidationError(this.socket, request);
			return;
		}
		switch(request.message.type) {
			case 'request-file-analysis':
				void this.handleFileAnalysisRequest(request.message as FileAnalysisRequestMessage);
				break;
			case 'request-slice':
				this.handleSliceRequest(request.message as SliceRequestMessage);
				break;
			case 'request-repl-execution':
				this.handleRepl(request.message as ExecuteRequestMessage);
				break;
			case 'request-lineage':
				this.handleLineageRequest(request.message as LineageRequestMessage);
				break;
			case 'request-query':
				this.handleQueryRequest(request.message as QueryRequestMessage);
				break;
			default:
				sendMessage<FlowrErrorMessage>(this.socket, {
					id:     request.message.id,
					type:   'error',
					fatal:  true,
					reason: `The message type ${JSON.stringify(request.message.type as string | undefined ?? 'undefined')} is not supported.`
				});
				this.socket.end();
		}
	}

	private async handleFileAnalysisRequest(base: FileAnalysisRequestMessage) {
		const requestResult = validateMessage(base, requestAnalysisMessage);
		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult, base.id);
			return;
		}
		const message = requestResult.message;
		this.logger.info(`[${this.name}] Received file analysis request for ${message.filename ?? 'unknown file'}${message.filetoken ? ' with token: ' + message.filetoken : ''}`);

		if(message.filetoken && this.fileMap.has(message.filetoken)) {
			this.logger.warn(`File token ${message.filetoken} already exists. Overwriting.`);
			// explicitly delete the previous store
			this.fileMap.delete(message.filetoken);
		}

		const tempFile = tmp.fileSync({ postfix: '.R' });
		const analyzer = await this.createAnalyzerForRequest(message, tempFile.name);

		try {
			await this.sendFileAnalysisResponse(analyzer, message);
		} catch(e) {
			this.logger.error(`[${this.name}] Error while analyzing file ${message.filename ?? 'unknown file'}: ${String(e)}`);
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     message.id,
				type:   'error',
				fatal:  false,
				reason: `Error while analyzing file ${message.filename ?? 'unknown file'}: ${String(e)}`
			});
		}

		// this is an interestingly named function that means "I am a callback that removes a file" - so this deletes the file
		tempFile.removeCallback();
	}

	private async sendFileAnalysisResponse(analyzer: FlowrAnalyzer, message: FileAnalysisRequestMessage): Promise<void> {
		let cfg: ControlFlowInformation | undefined = undefined;
		if(message.cfg) {
			cfg = await analyzer.controlFlow();
		}

		const config = (): QuadSerializationConfiguration => ({ context: message.filename ?? 'unknown', getId: defaultQuadIdGenerator() });
		const sanitizedResults = sanitizeAnalysisResults(await analyzer.parseOutput(), await analyzer.normalizedAst(), await analyzer.dataflow());
		if(message.format === 'n-quads') {
			sendMessage<FileAnalysisResponseMessageNQuads>(this.socket, {
				type:    'response-file-analysis',
				format:  'n-quads',
				id:      message.id,
				cfg:     cfg ? cfg2quads(cfg, config()) : undefined,
				results: {
					parse:     await printStepResult(PARSE_WITH_R_SHELL_STEP, await analyzer.parseOutput() as ParseStepOutput<string>, StepOutputFormat.RdfQuads, config()),
					normalize: await printStepResult(NORMALIZE, await analyzer.normalizedAst(), StepOutputFormat.RdfQuads, config()),
					dataflow:  await printStepResult(STATIC_DATAFLOW, await analyzer.dataflow(), StepOutputFormat.RdfQuads, config())
				}
			});
		} else if(message.format === 'compact') {
			sendMessage<FileAnalysisResponseMessageCompact>(this.socket, {
				type:    'response-file-analysis',
				format:  'compact',
				id:      message.id,
				cfg:     cfg ? compact(cfg) : undefined,
				results: compact(sanitizedResults)
			});
		} else {
			sendMessage(this.socket, {
				type:    'response-file-analysis',
				format:  'json',
				id:      message.id,
				cfg,
				results: sanitizedResults
			});
		}
	}

	private async createAnalyzerForRequest(message: FileAnalysisRequestMessage, tempFile: string) {
		let request: RParseRequests;
		if(message.content !== undefined){
			// we store the code in a temporary file in case it's too big for the shell to handle
			fs.writeFileSync(tempFile, message.content ?? '');
			request = { request: 'file', content: tempFile };
		} else if(message.filepath !== undefined) {
			if(typeof message.filepath === 'string') {
				request = { request: 'file', content: message.filepath };
			} else {
				request = message.filepath.map(fp => ({ request: 'file', content: fp }));
			}
		} else {
			throw new Error('Either content or filepath must be defined.');
		}

		const analyzer = await new FlowrAnalyzerBuilder(request)
			.setConfig(this.config)
			.setParser(this.parser)
			.build();

		if(message.filetoken) {
			this.logger.info(`Storing file token ${message.filetoken}`);
			this.fileMap.set(message.filetoken, {
				filename: message.filename,
				analyzer: analyzer
			});
		}
		return analyzer;
	}

	private handleSliceRequest(base: SliceRequestMessage) {
		const requestResult = validateMessage(base, requestSliceMessage);
		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult, base.id);
			return;
		}

		const request = requestResult.message;
		this.logger.info(`[${request.filetoken}] Received ${request.direction ?? SliceDirection.Backward} slice request with criteria ${JSON.stringify(request.criterion)}`);

		const fileInformation = this.fileMap.get(request.filetoken);
		if(!fileInformation) {
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     request.id,
				type:   'error',
				fatal:  false,
				reason: `The file token ${request.filetoken} has never been analyzed.`
			});
			return;
		}

		void fileInformation.analyzer.query([{
			type:            'static-slice',
			criteria:        request.criterion,
			noMagicComments: request.noMagicComments,
			direction: 		    request.direction
		}]).then(result => {
			sendMessage<SliceResponseMessage>(this.socket, {
				type:    'response-slice',
				id:      request.id,
				results: Object.fromEntries(
					Object.entries(result)
						.filter(([k,]) => DEFAULT_SLICING_PIPELINE.steps.get(k)?.executed === PipelineStepStage.OncePerRequest)
				) as SliceResponseMessage['results']
			});
		}).catch(e => {
			this.logger.error(`[${this.name}] Error while analyzing file for token ${request.filetoken}: ${String(e)}`);
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     request.id,
				type:   'error',
				fatal:  false,
				reason: `Error while analyzing file for token ${request.filetoken}: ${String(e)}`
			});
		});
	}


	private handleRepl(base: ExecuteRequestMessage) {
		const requestResult = validateMessage(base, requestExecuteReplExpressionMessage);

		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult, base.id);
			return;
		}

		const request = requestResult.message;

		const out = (stream: 'stdout' | 'stderr', msg: string) => {
			sendMessage<ExecuteIntermediateResponseMessage>(this.socket, {
				type:   'response-repl-execution',
				id:     request.id,
				result: msg,
				stream
			});
		};

		void replProcessAnswer(this.config, {
			formatter: request.ansi ? ansiFormatter : voidFormatter,
			stdout:    msg => out('stdout', msg),
			stderr:    msg => out('stderr', msg)
		}, request.expression, this.parser,
		this.allowRSessionAccess
		).then(() => {
			sendMessage<ExecuteEndMessage>(this.socket, {
				type: 'end-repl-execution',
				id:   request.id
			});
		});
	}

	private async handleLineageRequest(base: LineageRequestMessage) {
		const requestResult = validateMessage(base, requestLineageMessage);

		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult, base.id);
			return;
		}

		const request = requestResult.message;
		this.logger.info(`[${this.name}] Received lineage request for criterion ${request.criterion}`);

		const fileInformation = this.fileMap.get(request.filetoken);
		if(!fileInformation) {
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     request.id,
				type:   'error',
				fatal:  false,
				reason: `The file token ${request.filetoken} has never been analyzed.`
			});
			return;
		}

		const analyzer = fileInformation.analyzer;
		const lineageIds = getLineage(request.criterion, (await analyzer.dataflow()).graph, (await analyzer.normalizedAst()).idMap);
		sendMessage<LineageResponseMessage>(this.socket, {
			type:    'response-lineage',
			id:      request.id,
			lineage: [...lineageIds]
		});
	}

	private handleQueryRequest(base: QueryRequestMessage) {
		const requestResult = validateMessage(base, requestQueryMessage);

		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult, base.id);
			return;
		}

		const request = requestResult.message;
		this.logger.info(`[${this.name}] Received query request`);

		const fileInformation = this.fileMap.get(request.filetoken);
		if(!fileInformation) {
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     request.id,
				type:   'error',
				fatal:  false,
				reason: `The file token ${request.filetoken} has never been analyzed.`
			});
			return;
		}

		void Promise.resolve(fileInformation.analyzer.query(request.query)).then(results => {
			sendMessage<QueryResponseMessage>(this.socket, {
				type: 'response-query',
				id:   request.id,
				results
			});
		}).catch(e => {
			this.logger.error(`[${this.name}] Error while executing query: ${String(e)}`);
			sendMessage<FlowrErrorMessage>(this.socket, {
				id:     request.id,
				type:   'error',
				fatal:  false,
				reason: `Error while executing query: ${String(e)}`
			});
		});
	}
}

export function sanitizeAnalysisResults(parse: ParseStepOutput<any>, normalize: NormalizedAst, dataflow: DataflowInformation): DeepPartial<PipelineOutput<typeof DEFAULT_SLICING_PIPELINE>> {
	return {
		parse,
		normalize: {
			...normalize,
			idMap: undefined
		},
		dataflow: {
			...dataflow,
			// we want to keep the DataflowGraph type information, but not the idMap
			graph: new DataflowGraph(undefined).mergeWith(dataflow?.graph)
		}
	};
}
