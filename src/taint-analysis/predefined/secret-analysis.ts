import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { Identifier, PkgName } from '../../dataflow/environments/identifier';
import type { TaintConditionDomain, TaintConditionFunction, TaintParameterLocation } from '../taint-mapping';
import { TaintFnCategory } from '../function-categories';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { ArgProp, FileInputProps, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { argValueMappingFromBuiltInIndex } from '../builtin-index-bridge';

/** A confidential value, e.g., an API key read from the environment */
export const Secret = Symbol('Secret');
/** A secret placed into an authentication channel, e.g., `httr::authenticate(user, key)` */
export const Credential = Symbol('Credential');
/** The content of a file that may hold secrets, as no file is trusted by default */
export const FileContent = Symbol('FileContent');
/** A server response that keeps the credentials of its request, shown only when the whole object is written out */
export const Response = Symbol('Response');

export const secretDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, typeof Credential, typeof Secret, typeof FileContent, typeof Response]>()
	.addLeqOrder(Bottom, [Credential])
	.addLeqOrder(Credential, [Secret])
	.addLeqOrder(Secret, [FileContent])
	.addLeqOrder(FileContent, [Response])
	.addLeqOrder(Response, Top)
	.build();

/** Environment variable names that hold credentials */
export const CredentialNamePattern = /key|token|secret|pass(?:word)?|pwd|cred|auth|private/i;

/** Files that hold credentials */
export const CredentialFilePattern = /(?:^|[\\/])(?:\.Renviron|[._]netrc|\.pgpass|\.git-credentials|credentials(?:\.\w+)?)$/i;

/** How far the content of files is trusted not to hold secrets */
export enum FileTrust {
	/** any file may hold secrets, except trusted ones */
	None = 'none',
	/** only credential files hold secrets */
	CredentialFiles = 'credential-files'
}

/** Urls of endpoints that answer with a token */
export const TokenUrlPattern = /oauth|token|\/auth(?:enticate)?\b|\blogin\b|grant_type/i;

/** Where a secret goes when it reaches a sink */
export enum SecretSinkClass {
	/** sent over the network */
	Network = 'network',
	/** an authentication channel, the intended use */
	Auth = 'auth',
	/** shown in the browser of a Shiny app */
	Browser = 'browser',
	/** printed to logs or the console */
	Logs = 'logs',
	/** written to a file */
	Files = 'files',
	/** passed to another process, visible in its arguments */
	Process = 'process',
	/** sent to a large language model */
	Llm = 'llm'
}

/** functions through which a secret leaves the process */
export interface SecretSink {
	readonly class:        SecretSinkClass;
	readonly fns:          readonly Identifier[];
	/** the destination argument (url, host, or request) */
	readonly destination?: TaintParameterLocation;
	/** whether all arguments end up in the url, and thus in server logs */
	readonly inUrl?:       boolean;
	/** an argument redirecting output to a file */
	readonly file?:        TaintParameterLocation;
	/** what the call returns: the request it builds, holding its secrets, or the response of the server */
	readonly returns?:     'request' | 'response';
	/** whether it writes out the whole object, including the fields print methods hide */
	readonly serializes?:  boolean;
}

const index = BuiltInIndex.default();
const fromPkg = (pkg: string, ...names: string[]): Identifier[] => names.map(n => Identifier.make(n, pkg));
const methods = (...names: string[]): Identifier[] => names.map(n => Identifier.make(`$${n}`));
const logLevels = ['trace', 'debug', 'info', 'success', 'warn', 'error', 'fatal'];

export const DefaultSecretSinks: readonly SecretSink[] = [
	{ class: SecretSinkClass.Network, fns: fromPkg('httr', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'), destination: { pos: 0, name: 'url' }, returns: 'response' },
	{ class: SecretSinkClass.Network, fns: fromPkg('httr', 'VERB'), destination: { pos: 1, name: 'url' }, returns: 'response' },
	{ class: SecretSinkClass.Network, fns: fromPkg('httr2', 'request'), destination: { pos: 0, name: 'base_url' }, inUrl: true, returns: 'request' },
	{ class: SecretSinkClass.Network, fns: fromPkg('httr2', 'req_url', 'req_url_query', 'req_url_path', 'req_url_path_append'), destination: { pos: 0, name: 'req' }, inUrl: true, returns: 'request' },
	{ class: SecretSinkClass.Network, fns: fromPkg('httr2', 'req_body_json', 'req_body_form', 'req_body_raw', 'req_body_multipart', 'req_body_file'), destination: { pos: 0, name: 'req' }, returns: 'request' },
	{ class: SecretSinkClass.Network, fns: [...fromPkg('curl', 'curl_fetch_memory', 'curl_fetch_disk', 'curl_fetch_stream', 'curl', 'curl_download'), ...fromPkg('RCurl', 'getURL', 'getURLContent', 'postForm', 'getForm')], destination: { pos: 0, name: 'url' }, inUrl: true, returns: 'response' },
	{ class: SecretSinkClass.Network, fns: [...fromPkg(PkgName.Utils, 'download.file'), ...fromPkg(PkgName.Base, 'url')], destination: { pos: 0 }, inUrl: true },
	{ class: SecretSinkClass.Network, fns: fromPkg(PkgName.Base, 'socketConnection'), destination: { pos: 0, name: 'host' } },
	{ class: SecretSinkClass.Auth, fns: fromPkg('httr2', 'req_auth_bearer_token', 'req_auth_basic', 'req_headers', 'req_oauth_client_credentials', 'req_oauth_password', 'req_oauth_refresh', 'req_oauth_bearer_jwt', 'req_oauth_auth_code', 'req_auth_aws_v4'), destination: { pos: 0, name: 'req' } },
	{ class: SecretSinkClass.Auth, fns: fromPkg('DBI', 'dbConnect'), destination: { pos: -1, name: 'host' } },
	{ class: SecretSinkClass.Auth, fns: [...fromPkg('httr2', 'oauth_client'), ...fromPkg('httr', 'oauth_app'), ...fromPkg('curl', 'new_handle', 'handle_setheaders', 'handle_setopt')] },
	{ class: SecretSinkClass.Browser, fns:   [
		...fromPkg('shiny', 'renderPrint', 'renderText', 'renderUI', 'renderTable', 'renderDataTable', 'HTML', 'showNotification', 'updateTextInput', 'updateTextAreaInput', 'textInput', 'textAreaInput', 'passwordInput'),
		...fromPkg('htmltools', 'HTML'),
		...fromPkg('DT', 'renderDT', 'renderDataTable', 'datatable'),
		...fromPkg('shinyjs', 'runjs', 'html'),
		...methods('sendCustomMessage', 'sendInputMessage', 'sendBinaryMessage')
	] },
	{ class: SecretSinkClass.Logs, fns: fromPkg(PkgName.Base, 'cat'), file: { pos: -1, name: 'file' } },
	{ class: SecretSinkClass.Logs, fns: fromPkg(PkgName.Base, 'writeLines'), file: { pos: 1, name: 'con' } },
	{ class: SecretSinkClass.Files, fns: [...fromPkg(PkgName.Base, 'saveRDS', 'save', 'dput', 'dump', 'serialize'), ...fromPkg('readr', 'write_rds')], serializes: true },
	{ class: SecretSinkClass.Logs, fns: fromPkg(PkgName.Utils, 'str'), serializes: true },
	{ class: SecretSinkClass.Logs, fns:   [
		...index.with(SemanticCallTag.Prints),
		...fromPkg(PkgName.Base, 'stop', 'packageStartupMessage'),
		...fromPkg('logger', ...logLevels.map(l => `log_${l}`)),
		...fromPkg('futile.logger', ...logLevels.map(l => `flog.${l}`)),
		...fromPkg('rlang', 'inform', 'abort'),
		...fromPkg('cli', 'cli_alert', 'cli_alert_info', 'cli_alert_success', 'cli_alert_warning', 'cli_alert_danger', 'cli_inform', 'cli_warn', 'cli_abort', 'cli_text'),
		...fromPkg('clipr', 'write_clip')
	] },
	{ class: SecretSinkClass.Files, fns:   [
		...index.withAll([SemanticCallTag.File, SemanticCallTag.Writes]),
		...fromPkg(PkgName.Utils, 'write.csv', 'write.csv2', 'write.table'),
		...fromPkg(PkgName.Base, 'writeBin'),
		...fromPkg('DBI', 'dbWriteTable', 'dbAppendTable'),
		...fromPkg('pins', 'pin_write'),
		...fromPkg('googlesheets4', 'sheet_write', 'write_sheet', 'sheet_append'),
		...fromPkg('aws.s3', 's3saveRDS', 'put_object')
	] },
	{ class: SecretSinkClass.Process, fns: [...index.with(SemanticCallTag.Process), ...fromPkg(PkgName.Utils, 'browseURL')] },
	{ class: SecretSinkClass.Llm, fns:   [
		...fromPkg('ellmer', 'chat', 'chat_openai', 'chat_anthropic', 'chat_claude', 'chat_gemini', 'chat_google_gemini', 'chat_ollama', 'chat_mistral', 'chat_groq', 'chat_azure_openai', 'chat_bedrock'),
		...fromPkg('openai', 'create_chat_completion', 'create_completion'),
		...methods('chat', 'stream', 'chat_async', 'stream_async', 'chat_structured', 'set_system_prompt')
	] }
];

/** functions reading the body of a response */
const BodyReaders: readonly Identifier[] = [
	...fromPkg('httr', 'content'),
	...fromPkg('httr2', 'resp_body_string', 'resp_body_json', 'resp_body_raw', 'resp_body_html', 'resp_body_xml')
];

/** functions sending a built request, returning the response */
const Performers: readonly Identifier[] = fromPkg('httr2', 'req_perform', 'req_perform_sequential', 'req_perform_parallel', 'req_perform_iterative');

type SecretValue = typeof Secret | typeof Credential | typeof FileContent | typeof Response;
const has = (taints: readonly TaintConditionDomain<typeof secretDomain>[], ...values: SecretValue[]) => taints.some(t => values.includes(t?.value as SecretValue));
const isSecret = (taints: readonly TaintConditionDomain<typeof secretDomain>[]) => has(taints, Secret, Credential, FileContent);
/** the first of `order` among the arguments, ignoring constants (Top) */
const strongest = (...order: SecretValue[]): TaintConditionFunction<typeof secretDomain> => (_args, taints) => order.find(v => has(taints, v)) ?? Top;
const strongestSecret = strongest(Secret, Credential, FileContent, Response);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).filter(v => typeof v === 'string');

/** the response to a request carrying a secret: a token endpoint answers with a new secret */
const responseTaint: TaintConditionFunction<typeof secretDomain> = ([url], taints) =>
	!isSecret(taints) ? strongestSecret([], taints) : typeof url === 'string' && TokenUrlPattern.test(url) ? Secret : Response;

/** a response is secret only from a token endpoint, the credentials it keeps are not part of its body */
const bodyTaint = strongest(Secret, FileContent);

/** Extensions of the {@link secretAnalysis} */
export interface SecretAnalysisOptions {
	/** environment variable names holding credentials, defaults to {@link CredentialNamePattern} */
	readonly credentialNamePattern?: RegExp;
	/** functions whose result is secret */
	readonly sources?:               readonly Identifier[];
	/** functions whose result is never secret */
	readonly declassifiers?:         readonly Identifier[];
	/** where secrets leave the process, defaults to {@link DefaultSecretSinks} */
	readonly sinks?:                 readonly SecretSink[];
	/** how far files are trusted, defaults to {@link FileTrust.None} */
	readonly fileTrust?:             FileTrust;
	/** paths of files holding secrets, in addition to {@link CredentialFilePattern} */
	readonly secretFiles?:           RegExp;
	/** paths of files holding no secrets */
	readonly trustedFiles?:          RegExp;
}

/** The {@link secretAnalysis}, extended by the given options */
export function createSecretAnalysis({ credentialNamePattern = CredentialNamePattern, sources = [], declassifiers = [], sinks = DefaultSecretSinks, fileTrust = FileTrust.None, secretFiles, trustedFiles }: SecretAnalysisOptions = {}) {
	const fileTaint: TaintConditionFunction<typeof secretDomain> = ([path]) => {
		const paths = strings(path);
		if(paths.some(p => CredentialFilePattern.test(p) || secretFiles?.test(p))) {
			return Secret;
		}
		return fileTrust === FileTrust.CredentialFiles || (paths.length > 0 && paths.every(p => trustedFiles?.test(p))) ? Top : FileContent;
	};
	const credentialNameTaint: TaintConditionFunction<typeof secretDomain> = ([name]) =>
		strings(name).length === 0 || strings(name).some(n => credentialNamePattern.test(n)) ? Secret : Top;
	const sinksOf = (keep: (sink: SecretSink) => boolean) => sinks.filter(keep).flatMap(s => s.fns);
	return TaintAnalysisDefinition.create('secret', secretDomain)
		.on(TaintFnCategory.pureAlias)
		.on(TaintFnCategory.pureComputer, strongestSecret)
		.on(TaintFnCategory.pureShape, () => Top)
		.from(
			{
				identifier: ['Sys.getenv', PkgName.Base],
				condition:  { argValues: [{ pos: 0, name: 'x' }], conditionFn: credentialNameTaint }
			},
			{
				identifier: [
					...fromPkg('keyring', 'key_get', 'key_get_raw'),
					...fromPkg('config', 'get'),
					...fromPkg(PkgName.Base, 'readRenviron'),
					...fromPkg('httr', 'oauth2.0_token', 'oauth1.0_token', 'oauth_service_token'),
					...fromPkg('httr2', 'oauth_flow_auth_code', 'oauth_flow_client_credentials', 'oauth_flow_password', 'oauth_flow_refresh', 'oauth_flow_device', 'oauth_flow_bearer_jwt', 'oauth_flow_token_exchange', 'oauth_token_cached'),
					...fromPkg('gargle', 'token_fetch', 'credentials_service_account', 'credentials_user_oauth2', 'credentials_app_default'),
					...fromPkg('AzureAuth', 'get_azure_token'),
					...fromPkg('gh', 'gh_token'),
					...fromPkg('gitcreds', 'gitcreds_get'),
					...fromPkg('askpass', 'askpass'),
					...fromPkg('getPass', 'getPass'),
					...fromPkg('rstudioapi', 'askForPassword', 'askForSecret'),
					...sources
				],
				taint: Secret
			},
			...argValueMappingFromBuiltInIndex(FileInputProps, ArgProp.Resource, fileTaint)
		)
		.through(
			{
				identifier: [
					...fromPkg('digest', 'digest', 'sha1', 'hmac'),
					...fromPkg('openssl', 'sha1', 'sha256', 'sha512', 'md5', 'sha2'),
					...fromPkg('sodium', 'password_store', 'hash', 'sha256'),
					...fromPkg(PkgName.Base, 'nzchar', 'is.na', 'is.null', 'nchar', 'identical', '==', '!=', 'isTRUE', 'isFALSE'),
					...declassifiers
				],
				taint: Top
			},
			{
				identifier: [...fromPkg(PkgName.Base, '$', '[[', '[', '@'), ...BodyReaders],
				condition:  { argDefinition: [{ pos: 0 }], conditionFn: bodyTaint }
			},
			{
				identifier: [...fromPkg(PkgName.Base, 'enc2utf8', 'trimws', 'unname', 'rawToChar', 'do.call'), ...fromPkg(PkgName.Utils, 'URLencode'), ...fromPkg('jsonlite', 'fromJSON', 'parse_json', 'toJSON'), ...fromPkg('base64enc', 'base64encode'), ...fromPkg('jsonlite', 'base64_enc')],
				condition:  { argDefinition: [{ pos: 0 }], conditionFn: strongestSecret }
			},
			{
				identifier: [...fromPkg('httr', 'authenticate', 'add_headers', 'config'), ...sinksOf(s => s.class === SecretSinkClass.Auth)],
				condition:  { allArgs: true, conditionFn: (_args, taints) => isSecret(taints) ? Credential : Top }
			},
			{
				identifier: sinksOf(s => s.returns === 'request'),
				condition:  { allArgs: true, conditionFn: strongestSecret }
			},
			{
				identifier: [...Performers, ...sinksOf(s => s.returns === 'response')],
				condition:  { argValues: [{ pos: 0, name: 'url' }], allArgs: true, conditionFn: responseTaint }
			}
		)
		.to(
			{
				identifier: sinksOf(s => s.serializes === true),
				condition:  { allArgs: true, conditionFn: (_args, taints) => has(taints, Secret, Credential, FileContent, Response) ? Bottom : undefined }
			},
			{
				identifier: sinksOf(s => s.class !== SecretSinkClass.Auth && s.class !== SecretSinkClass.Network && !s.serializes),
				condition:  { allArgs: true, conditionFn: (_args, taints) => isSecret(taints) ? Bottom : undefined }
			}
		)
		.report(f => `A secret reaches '${f.functionName ?? f.lexeme}', where it leaves the process [${f.locString}]`);
}

/**
 * Tracks secrets (environment, keyrings, config, credential files, tokens, password prompts) to where they leave the process.
 * By default, the content of any file may hold secrets ({@link FileContent}), see {@link FileTrust}.
 * Hashes and presence checks declassify them, authentication channels make them a {@link Credential}, and requests carrying
 * them return a {@link Response}, or a new secret from a token endpoint.
 * Network calls are no findings here, as whether sending a secret leaks it depends on the destination (see `secret-exfiltration`).
 */
export const secretAnalysis = createSecretAnalysis();
