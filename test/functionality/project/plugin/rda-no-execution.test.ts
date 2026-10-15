import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { RDAParser, SexpType } from '../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import type { FlowrFileProvider } from '../../../../src/project/context/flowr-file';
import { label } from '../../_helper/label';

/**
 * Serialized R files (`.rda`, `.rds`, `.rdx`) are part of the analyzed, possibly hostile, project.
 * flowR reads them without running R: a namespace reference in such a file must not reach an R session.
 */
describe('Reading serialized R files runs no R', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-rda-no-exec-'));
	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	/** an XDR (version 2) serialization stream of a single namespace reference named `name` */
	function namespaceReference(name: string): Buffer {
		const int = (v: number) => {
			const b = Buffer.alloc(4);
			b.writeInt32BE(v);
			return b;
		};
		const bytes = Buffer.from(name, 'utf8');
		return Buffer.concat([
			Buffer.from('X\n'), int(2), int(0x040400), int(0x020300),
			int(SexpType.NamespaceSxp), int(0), int(1),
			/* CHARSXP, UTF-8 */ int(SexpType.CharSxp | (8 << 12)), int(bytes.length), bytes
		]);
	}

	test.each(['two', 'three'])(label('a crafted namespace name is not evaluated (%s quotes)', ['name-normal'], ['other']), quotes => {
		const marker = path.join(dir, `pwned-${quotes}`).replaceAll('\\', '/');
		const name = quotes === 'two'
			? `x"); file.create("${marker}"); invisible("`
			: `x", "y"); file.create("${marker}"); invisible("`;
		const file = path.join(dir, `evil-${quotes}.rds`);
		fs.writeFileSync(file, namespaceReference(name));
		const result = new RDAParser({ path: () => file } as unknown as FlowrFileProvider, false).parseObject();
		assert.isFalse(fs.existsSync(marker), 'the R code in the namespace name must not run');
		assert.strictEqual((result as { type?: SexpType }).type, SexpType.EnvSxp, 'the namespace is read as an (unknown) environment');
	});
});
