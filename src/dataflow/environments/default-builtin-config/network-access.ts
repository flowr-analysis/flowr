import { sig, Forced } from './shared-signatures';
import { fn, pkg, Primitive } from './define-helpers';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { Downloads } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of network access, downloads, and remote storage. */
export const NetworkDefinitions = [
	/* the calls that always reach the network, each naming the argument that carries the address; the `network-functions` rule reads them back from here rather than keeping a list of its own */
	fn(pkg(PkgName.Httr, 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'BROWSE'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, config: Forced.Value, '...': Forced.Value }) }),
	/* `VERB`/`RETRY` take the method first, so the address is the second argument rather than the first */
	fn(pkg(PkgName.Httr, 'VERB', 'RETRY'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ verb: Forced.Value, url: Forced.Resource, config: Forced.Value, '...': Forced.Value }) }),
	fn(pkg(PkgName.Httr, 'handle'), BuiltInProcName.Default, { libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Network], sig: sig({ url: Forced.Resource }) }),
	fn(pkg(PkgName.Httr, 'oauth_endpoint'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network], sig: sig({ request: Forced.Resource, authorize: Forced.Resource, access: Forced.Resource, '...': Forced.Value, base_url: Forced.Resource }) }),
	fn(pkg(PkgName.Curl, 'curl'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, open: Forced.Flag, handle: Forced.Handle }) }),
	fn(pkg(PkgName.Curl, 'curl_fetch_memory', 'curl_fetch_stream', 'nslookup', 'curl_escape', 'has_internet'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Curl, 'curl_fetch_disk'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ url: Forced.Resource, path: Forced.Resource | ArgProp.Written, handle: Forced.Handle }) }),
	fn(pkg(PkgName.Curl, 'curl_download'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: Downloads, sig: sig({ url: Forced.Resource, destfile: Forced.Resource | ArgProp.Written, quiet: Forced.Flag, mode: Forced.Value, handle: Forced.Handle }) }),
	fn(pkg(PkgName.Curl, 'multi_download'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ urls: Forced.Resource, destfiles: Forced.Resource | ArgProp.Written, '...': Forced.Value }) }),
	/* `curl_upload` sends a file somewhere, so the file it reads comes first and the address second */
	fn(pkg(PkgName.Curl, 'curl_upload'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, url: Forced.Resource, verbose: Forced.Flag, '...': Forced.Value }) }),
	fn(pkg(PkgName.Curl, 'curl_echo'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network], sig: sig({ handle: Forced.Handle, port: Forced.Value, progress: Forced.Flag }) }),
	fn(pkg(PkgName.Curl, 'new_handle'), BuiltInProcName.Default, { libFn: true, tags: [SemanticCallTag.Opens], sig: sig({ '...': Forced.Value }) }),
	fn([...pkg(PkgName.Rcurl, 'getURL'), ...pkg(PkgName.Rbdat, 'getForm')], BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Rvest, 'html_nodes', 'html_text'), BuiltInProcName.Default, { libFn: true, sig: sig({ x: Forced.Value, '...': Forced.Value }) }),
	fn(pkg(PkgName.Rvest, 'read_html_live', 'session'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Rvest, 'session_jump_to', 'session_follow_link', 'session_submit', 'session_back', 'session_forward'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ x: Forced.Handle, '...': Forced.Value }) }),
	/* an `httr2` request is only a description until one of these performs it */
	fn(pkg(PkgName.Httr2, 'req_perform_sequential', 'req_perform_parallel', 'req_perform_iterative', 'req_perform_stream', 'req_perform_connection', 'req_perform_promise'),
		BuiltInProcName.Default, { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ req: Forced.Value, '...': Forced.Value }) }),
	fn(pkg(PkgName.GoogleDrive, 'drive_get', 'shared_drive_get'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.GoogleDrive, 'shared_drive_rm'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.AwsS3, 's3read_using'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ FUN: ArgProp.Forced | ArgProp.Callee, '...': Forced.Value, object: Forced.Resource }) }),
	fn(pkg(PkgName.AwsS3, 's3write_using'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ FUN: ArgProp.Forced | ArgProp.Callee, '...': Forced.Value, object: Forced.Resource }) }),
	fn(pkg(PkgName.GoogleCloudStorageR, 'gcs_get_object'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ object_name: Forced.Resource, saveToDisk: Forced.Resource | ArgProp.Written | ArgProp.Optional, '...': Forced.Value }) }),
	fn(pkg(PkgName.GoogleDrive, 'drive_download'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: Downloads, sig: sig({ file: Forced.Resource, path: Forced.Resource | ArgProp.Written, type: ArgProp.Value, overwrite: ArgProp.Flag, verbose: ArgProp.Flag }) }),
	fn(pkg(PkgName.Httr2, 'req_perform'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ req: Forced.Value, path: Forced.Resource | ArgProp.Written | ArgProp.Optional, verbosity: ArgProp.Value, mock: ArgProp.Value, error_call: ArgProp.Value }) }),
	fn(pkg(PkgName.Downloader, 'download'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: Downloads, sig: sig({ url: Forced.Resource, '...': Forced.Value, destfile: Forced.Resource | ArgProp.Written }) }),
	fn(pkg(PkgName.Piggyback, 'pb_download'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: Downloads, sig: sig({ file: Forced.Value, dest: Forced.Resource | ArgProp.Written, repo: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Osfr, 'osf_download'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ x: Forced.Resource, path: Forced.Resource | ArgProp.Written, '...': Forced.Value }) }),
	fn(pkg(PkgName.AwsS3, 'save_object'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ object: Forced.Resource, bucket: Forced.Value, file: Forced.Resource | ArgProp.Written, '...': Forced.Value }) }),
	fn(pkg(PkgName.Zen4R, 'download_zenodo'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: Downloads, sig: sig({ doi: Forced.Resource, path: Forced.Resource | ArgProp.Written, '...': Forced.Value }) }),
	fn([...pkg(PkgName.AnnotationHub, 'AnnotationHub'), ...pkg(PkgName.ExperimentHub, 'ExperimentHub')], BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ hub: Forced.Resource, '...': Forced.Value }) }),
	fn([...pkg(PkgName.Soda, 'evalText'), ...pkg(PkgName.FastUtils, 'evalText')], BuiltInProcName.Eval,
		{ includeFunctionCall: true, supportFunctionCall: true, keepEnvironment: true, tags: [SemanticCallTag.Eval], sig: sig({ text: Forced.Value | ArgProp.Injectable, envir: Forced.Value }) },
		Primitive),
] as const satisfies AnyBuiltInDefinition[];
