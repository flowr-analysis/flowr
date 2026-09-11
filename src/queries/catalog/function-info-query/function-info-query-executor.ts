import type { BasicQueryData } from '../../base-query-format';
import type { FunctionInfoPackageHit, FunctionInfoQuery, FunctionInfoQueryResult } from './function-info-query-format';
import { builtinModelsOf } from './function-origin';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { Identifier } from '../../../dataflow/environments/identifier';

/**
 * Executes a function-info query: looks up `name` in the loaded signature database(s) (optionally restricted to
 * `packages`) and in flowR's own built-in configuration, see {@link builtinModelsOf}.
 */
export function executeFunctionInfoQuery({ analyzer }: BasicQueryData, queries: readonly FunctionInfoQuery[]): Promise<FunctionInfoQueryResult> {
	const start = Date.now();
	const query = queries[queries.length - 1];
	const deps = analyzer.inspectContext().deps;
	deps.getDependency(query.name);
	const sigDb = deps.signatures();
	const exporting = sigDb.packagesExporting(query.name);
	const candidates = query.packages;
	const matching = candidates === undefined ? exporting : exporting.filter(p => candidates.includes(p));
	const packages: FunctionInfoPackageHit[] = [...matching.filter(p => isBaseRPackage(p)), ...matching.filter(p => !isBaseRPackage(p))].map(pkg => {
		const id = Identifier.make(query.name, pkg);
		const fn = sigDb.functionOf(id) ?? sigDb.rawFunctionOf(id);
		return {
			package:    pkg,
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
		builtin: builtinModelsOf(query.name, analyzer.inspectContext())
	});
}
