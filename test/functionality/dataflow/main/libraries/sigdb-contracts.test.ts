import { afterAll, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import type { SigFunctionInfo } from '../../../../../src/project/sigdb/schema';
import type { StatedGuards } from '../../../../../src/dataflow/fn/guards/built-in-guards';
import { cleanupSigTmpDirs, sigTmpDir, writeAndOpen, ver } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-11-09', generated: 0 };

const Positive: StatedGuards = {
	requires: 'is.numeric(x) && x > 0',
	required: ['x'],
	because:  [{ requires: 'is.numeric(x) && x > 0', kind: 'explicit', fails: 'stopifnot(is.numeric(x), x > 0)' }]
};
const Character: StatedGuards = { requires: 'is.character(s)' };

const fn = (name: string, guards?: StatedGuards): SigFunctionInfo => ({ name, props: 1, params: [{ name: 'x' }], callees: [], ...(guards ? { guards } : {}) });

function build(versions: Record<string, SigFunctionInfo[]>, features?: Record<string, boolean>) {
	const b = new SigDbBuilder();
	const names = Object.keys(versions);
	b.addPackage('p', { latest: names[names.length - 1] });
	for(const [v, fns] of Object.entries(versions)) {
		b.addVersion('p', v, ver(fns));
	}
	return b.build(features ? { ...meta, features } : meta);
}

describe('Contracts in the signature database', () => {
	test('a function\'s contract round-trips through a written bundle, one without stays without', async() => {
		const rd = await writeAndOpen(sigTmpDir('sigdb-contracts-rt-'), build({ '1.0': [fn('pos', Positive), fn('plain'), fn('chr', Character)] }));
		expect(rd.functionByName('p', 'pos')?.guards).toEqual(Positive);
		expect(rd.functionByName('p', 'chr')?.guards).toEqual(Character);
		expect(rd.functionByName('p', 'plain')?.guards).toBeUndefined();
		rd.close();
	});

	test('versions share a record only if their contracts agree', async() => {
		const db = build({ '1.0': [fn('f', Positive)], '2.0': [fn('f', Positive)], '3.0': [fn('f', Character)], '4.0': [fn('f')] });
		const blob = db.blobs[db.pkgs['p']];
		expect(blob.fns).toHaveLength(3);
		expect(blob.contracts).toHaveLength(2);
		const rd = await writeAndOpen(sigTmpDir('sigdb-contracts-ver-'), db);
		expect(rd.functionByName('p', 'f', '1.0')?.guards).toEqual(Positive);
		expect(rd.functionByName('p', 'f', '3.0')?.guards).toEqual(Character);
		expect(rd.functionByName('p', 'f', '4.0')?.guards).toBeUndefined();
		rd.close();
	});

	test('turning the feature off stores none', () => {
		const db = build({ '1.0': [fn('pos', Positive)] }, { contracts: false });
		expect(db.blobs[db.pkgs['p']].contracts).toBeUndefined();
		expect(db.content.features?.contracts).toBe(false);
	});
});
