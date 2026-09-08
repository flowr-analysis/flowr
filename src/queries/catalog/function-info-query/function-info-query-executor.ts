import type { BasicQueryData } from '../../base-query-format';
import type { FunctionInfoPackageHit, FunctionInfoQuery, FunctionInfoQueryResult } from './function-info-query-format';
import { functionOrigin } from './function-origin';
import { Identifier } from '../../../dataflow/environments/identifier';

/**
 * Executes a function-info query: looks up `name` in the loaded signature database(s) (optionally restricted to
 * `packages`) and in flowR's own built-in configuration, via the shared {@link functionOrigin} helper.
 */
export function executeFunctionInfoQuery({ analyzer }: BasicQueryData, queries: readonly FunctionInfoQuery[]): Promise<FunctionInfoQueryResult> {
	const start = Date.now();
	const query = queries[queries.length - 1];
	const deps = analyzer.inspectContext().deps;
	/* `packagesExporting` answers from the version plugins, which only resolve their sources once a dependency
	   has actually been asked for; a `getDependency` no-op is the public way to force that the very first time */
	deps.getDependency(query.name);
	const sigDb = deps.signatures();
	const origin = functionOrigin(sigDb, query.name, query.packages);
	const packages: FunctionInfoPackageHit[] = origin.packages.map(pkg => {
		const id = Identifier.make(query.name, pkg);
		const fn = sigDb.functionOf(id) ?? sigDb.rawFunctionOf(id);
		return {
			package:    pkg,
			/* `packagesExporting` already means the package's export list carries the name; a missing decoded
			   entry (a database gap) does not make that untrue, so `exported` defaults to true rather than false */
			exported:   fn?.exported ?? true,
			parameters: fn?.signature.map(p => p.name),
			file:       fn?.file,
			line:       fn?.line
		};
	});
	return Promise.resolve({
		'.meta': { timing: Date.now() - start },
		name:    query.name,
		packages,
		builtin: origin.builtin
	});
}
