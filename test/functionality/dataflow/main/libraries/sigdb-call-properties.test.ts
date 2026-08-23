import { afterAll, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import { FnProp } from '../../../../../src/project/sigdb/schema';
import { fnInfoFromSignature, CallProp } from '../../../../../src/dataflow/environments/built-in-props';
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
		return decodeFunction(db.strings, db.blobs[db.pkgs['p']], 0);
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
