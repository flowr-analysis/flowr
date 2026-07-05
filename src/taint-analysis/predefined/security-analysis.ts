import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { UserFunctions } from '../../queries/catalog/input-sources-query/input-source-functions';

export const UserInput = Symbol('User Input');
export const NetworkInput = Symbol('Network Input');
export const FileInput = Symbol('File Input');

type SecurityLatticeElements = [typeof UserInput, typeof NetworkInput, typeof FileInput];


export const securityDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...SecurityLatticeElements]>()
	.addLeqOrder(Bottom, [UserInput, NetworkInput, FileInput])
	.addLeqOrder(UserInput, Top)
	.addLeqOrder(NetworkInput, Top)
	.addLeqOrder(FileInput, Top)
	.build();

export const securityAnalysis = new TaintAnalysisDefinition('security', securityDomain)
	.through([
		{
			identifier: UserFunctions,
			taint:      UserInput
		},
		{
			identifier: ['read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2', 'readRDS', 'download.file', 'url', 'GET', 'POST', 'PUT',
				'DELETE', 'PATCH', 'HEAD', 'content', 'handle', 'get_callback', 'VERB', 'fread', 'gzcon', 'readlines', 'readLines', 'load', 'curl_download', // TODO Fix source ambiguity
				'curl_fetch_memory', 'getURL', 'getForm', 'read_html', 'read_xml', 'html_nodes', 'html_text', 'fromJSON', 'read.xlsx', 'drive_download', 'drive_get',
				's3read_using', 's3write_using', 'storage_download', 'AnnotationHub', 'ExperimentHub', 'scan',
				'socketConnection', 'request', 'curl'],
			taint: NetworkInput,
		}
	])
	.to([
		{
			identifier: [
				'eval', 'evalq',
				'system', 'system2', 'shell',
				'dyn.load',
				'source', 'sys.source',
				'.C', '.Fortran', '.External',
				'read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.delim2',
				'read.rds', 'load', 'unserialize', 'parse', 'parse.file',
				'download.file', 'url', 'socketConnection', 'pipe', 'fifo', 'gzfile', 'bzfile', 'xzfile',
				'file.create', 'file.append', 'file.remove', 'file.rename', 'file.copy',
				'write.table', 'write.csv', 'write.csv2', 'write.delim', 'write.delim2',
				'save', 'saveRDS', 'serialize', 'dump', 'save.history', 'save.image',
				'pdf'
			],
			condition: {
				argTaints: [{ pos: 0 }],
				condition: (_args, [taint]) => (taint === UserInput || taint === NetworkInput || taint === FileInput) ? Bottom : taint
			}
		}
	])
	.report('User input potentially flowing to output');