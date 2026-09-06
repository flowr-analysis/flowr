import { SigDict } from '../../../../../src/project/sigdb/dict';
import { afterAll, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import { FnProp } from '../../../../../src/project/sigdb/schema';
import { ArgProp, fnInfoFromSignature, CallProp, PropagatedProps } from '../../../../../src/dataflow/environments/built-in-props';
import { BuiltInIndex } from '../../../../../src/dataflow/environments/query-fn-props';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';
import { decodeFunction } from '../../../../../src/project/sigdb/decode';
import { cleanupSigTmpDirs, ver } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-05-23', generated: 0 };

describe('The generic call property', () => {
	/** the decoded view of one function, which is what flowR reads its properties off */
	const decoded = (props: number, callees: string[] = []) => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', ver([{ name: 'f', props: FnProp.Exported | props, params: [], callees }]));
		const db = b.build(meta);
		return decodeFunction(SigDict.of(db.strings), db.blobs[db.pkgs['p']], 0);
	};

	test('the generic bit is stored and read back as a property', () => {
		expect(decoded(FnProp.Generic).props).toContain('generic');
		expect(decoded(0).props).not.toContain('generic');
	});

	test('a stored generic states the call property without needing a call graph', () => {
		expect((fnInfoFromSignature(decoded(FnProp.Generic)).props ?? 0) & CallProp.Generic).toBeTruthy();
		/* the dispatching callee still settles it for a bundle written before the bit existed */
		expect((fnInfoFromSignature(decoded(0, ['UseMethod'])).props ?? 0) & CallProp.Generic).toBeTruthy();
		expect((fnInfoFromSignature(decoded(0, ['print'])).props ?? 0) & CallProp.Generic).toBeFalsy();
	});
});

describe('The concurrent call property', () => {
	const builtIns = BuiltInIndex.default();
	const propsOf = (name: string, pkg: string) => builtIns.propsOf(Identifier.make(name, pkg)) ?? 0;

	test.each([
		['future', 'future', true], ['future_map', 'furrr', true], ['%dopar%', 'foreach', true],
		['mirai', 'mirai', true], ['r_bg', 'callr', true],
		['lapply', 'base', false], ['map', 'purrr', false]
	] as const)('%s::%s is concurrent: %s', (name, pkg, expected) => {
		expect(!!(propsOf(name, pkg) & CallProp.Concurrent)).toBe(expected);
	});

	test('`parallel` stays with the signature database, so its exports still need a library() call', () => {
		/* declaring them here would resolve a bare `mclapply()` and silence the undefined-symbol linter */
		expect(builtIns.get(Identifier.make('mclapply', 'parallel'))).toBeUndefined();
	});

	test('it carries over, so a function reaching one is concurrent too', () => {
		expect(PropagatedProps.props & CallProp.Concurrent).toBeTruthy();
	});

	test('what each argument is for is stated with it', () => {
		const sig = builtIns.get(Identifier.make('future_map', 'furrr'))?.sig ?? [];
		expect(sig.find(([name]) => name === '.f')?.[1]).toBe(ArgProp.Callee);
		expect(sig.find(([name]) => name === '.x')?.[1]).toBe(ArgProp.Value);
		/* callr hands the callee to a background process, and the process is a handle to wait on */
		const bg = builtIns.get(Identifier.make('r_bg', 'callr'))?.sig ?? [];
		expect(bg.find(([name]) => name === 'func')?.[1]).toBe(ArgProp.Callee);
	});

	test.each([
		['future', 'future'], ['mirai', 'mirai'], ['%dopar%', 'foreach']
	] as const)('%s::%s marks the expression a backend ships elsewhere as not evaluated here', (name, pkg) => {
		const sig = builtIns.get(Identifier.make(name, pkg))?.sig ?? [];
		expect(sig.some(([, props]) => (props & ArgProp.Nse) !== 0)).toBe(true);
	});
});
