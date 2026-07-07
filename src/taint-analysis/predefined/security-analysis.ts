import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { UserFunctions } from '../../queries/catalog/input-sources-query/input-source-functions';
import { Identifier } from '../../dataflow/environments/identifier';

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

/** Matches network protocols in a path argument (mirrors the network-functions linter rule). */
const NetworkProtocolRegex = /^(https?|ftps?):\/\//;

/** Maps a resolved path argument to a network or file taint depending on its protocol. */
const protocolTaint = (path: unknown) =>
	typeof path === 'string' && NetworkProtocolRegex.test(path) ? NetworkInput : FileInput;

export const securityAnalysis = new TaintAnalysisDefinition('security', securityDomain)
	.through([
		{
			identifier: UserFunctions,
			taint:      UserInput
		},
		{
			identifier: [
				Identifier.make('download.file', 'utils'),
				Identifier.make('url', 'base'),
				Identifier.make('socketConnection', 'base'),
			],
			taint: NetworkInput,
		},
		{
			identifier: [
				Identifier.make('readRDS', 'base'),
				Identifier.make('load', 'base'),
				Identifier.make('scan', 'base'),

				Identifier.make('read.table', 'utils'),
				Identifier.make('read.csv', 'utils'),
				Identifier.make('read.csv2', 'utils'),
				Identifier.make('read.delim', 'utils'),
				Identifier.make('read.delim2', 'utils'),
			],
			condition: {
				argValues: [{ pos: 0, name: 'file' }],
				condition: ([path]) => protocolTaint(path)
			}
		},
		{
			identifier: [
				Identifier.make('readLines', 'base'),
				Identifier.make('gzcon', 'base')
			],
			condition: {
				argValues: [{ pos: 0, name: 'con' }],
				condition: ([path]) => protocolTaint(path)
			}
		},
	])
	.to([
		{
			identifier: [
				Identifier.make('eval', 'base'),
				Identifier.make('evalq', 'base'),
				Identifier.make('system', 'base'),
				Identifier.make('system2', 'base'),
				Identifier.make('shell', 'base'),
				Identifier.make('dyn.load', 'base'),
				Identifier.make('source', 'base'),
				Identifier.make('sys.source', 'base'),
				Identifier.make('.C', 'base'),
				Identifier.make('.Fortran', 'base'),
				Identifier.make('.External', 'base'),
				Identifier.make('unserialize', 'base'),
				Identifier.make('parse', 'base'),
				Identifier.make('pipe', 'base'),
				Identifier.make('fifo', 'base'),
				Identifier.make('gzfile', 'base'),
				Identifier.make('bzfile', 'base'),
				Identifier.make('xzfile', 'base'),
				Identifier.make('file.create', 'base'),
				Identifier.make('file.append', 'base'),
				Identifier.make('file.remove', 'base'),
				Identifier.make('file.rename', 'base'),
				Identifier.make('file.copy', 'base'),
				Identifier.make('save', 'base'),
				Identifier.make('saveRDS', 'base'),
				Identifier.make('serialize', 'base'),
				Identifier.make('dump', 'base'),
				Identifier.make('save.image', 'base'),

				Identifier.make('write.table', 'utils'),
				Identifier.make('write.csv', 'utils'),
				Identifier.make('write.csv2', 'utils'),
				Identifier.make('pdf', 'grDevices')

				//Identifier.make('load', 'base'),
				//Identifier.make('socketConnection', 'base'),
				//Identifier.make('read.table', 'base'),
				//Identifier.make('read.csv', 'utils'),
				//Identifier.make('read.csv2', 'utils'),
				//Identifier.make('read.delim', 'utils'),
				//Identifier.make('read.delim2', 'utils'),
				//Identifier.make('download.file', 'utils'),
				//Identifier.make('url', 'base'),
			],
			condition: {
				argTaints: [{ pos: 0 }],
				condition: (_args, [taint]) => (taint === UserInput || taint === NetworkInput || taint === FileInput) ? Bottom : taint
			}
		}
	])
	.report('User input potentially flowing to output');
