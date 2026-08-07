// Check the `Generic` labels of the built-in store against a synced signature database, which the test suite
// does not load (see `test/functionality/test-setup.ts`).
import { info } from './script-log';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';
import { BuiltInIndex, inferFnProps } from '../src/dataflow/environments/query-fn-props';
import { CallProp } from '../src/dataflow/environments/built-in-props';
import { Identifier, PkgName } from '../src/dataflow/environments/identifier';
import { AttachedBasePackages } from '../src/util/r-base-packages';

const KnownFalsePositives = ['methods::setGeneric'];

const isGeneric = (props: number | undefined) => ((props ?? 0) & CallProp.Generic) !== 0;

void (async() => {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	const sources = analyzer.inspectContext().deps.signatureSources();
	if(sources.length === 0) {
		info('check-generic-labels: no signature database is mounted, run `npm run sync:sigdb` first');
		return;
	}
	const missing = BuiltInIndex.default().entries.filter(entry => {
		const pkg = Identifier.getNamespace(entry.name) ?? PkgName.Base;
		return !isGeneric(entry.props) && AttachedBasePackages.includes(pkg)
			&& sources.some(src => isGeneric(inferFnProps(src, pkg, Identifier.getName(entry.name))?.props));
	}).map(entry => Identifier.toString(entry.name)).filter(name => !KnownFalsePositives.includes(name));

	if(missing.length === 0) {
		info('check-generic-labels: the labels agree with the signature database');
		return;
	}
	console.error(`check-generic-labels: the database states that these dispatch, add them to \`RGenerics\`:\n  ${missing.join('\n  ')}`);
	process.exitCode = 1;
})();
