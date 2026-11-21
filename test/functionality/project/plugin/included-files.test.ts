import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../_helper/shell';
import { analyze } from '../../_helper/analyzer';

describe('Included files', { concurrent: false }, withTreeSitter(parser => {
	let tmp: string;
	beforeAll(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-included-'));
	});
	afterAll(() => {
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	async function orderOf(files: Record<string, string>): Promise<string[]> {
		const dir = fs.mkdtempSync(path.join(tmp, 'p-'));
		for(const [name, content] of Object.entries(files)) {
			fs.writeFileSync(path.join(dir, name), content);
		}
		const analyzer = await analyze(parser, 'file://' + dir);
		return analyzer.inspectContext().files.loadingOrder.getLoadingOrder()
			.map(r => r.request === 'file' ? path.basename(r.content) : '<text>');
	}

	test('a knitr child is not analyzed on its own as well', async() => {
		assert.deepEqual(await orderOf({
			'p.Rmd': '```{r child="c.Rmd"}\n```\n',
			'c.Rmd': '```{r}\nlibrary(ggplot2)\n```\n'
		}), ['p.Rmd']);
	});

	test('a quarto include is not analyzed on its own as well', async() => {
		assert.deepEqual(await orderOf({
			'p.qmd': '{{< include c.qmd >}}\n',
			'c.qmd': '```{r}\nlibrary(ggplot2)\n```\n'
		}), ['p.qmd']);
	});

	test('an unrelated document stays in the order', async() => {
		assert.sameMembers(await orderOf({
			'p.Rmd':     '```{r child="c.Rmd"}\n```\n',
			'c.Rmd':     '```{r}\nlibrary(ggplot2)\n```\n',
			'other.Rmd': '```{r}\nlibrary(cli)\n```\n'
		}), ['p.Rmd', 'other.Rmd']);
	});

	test('an unresolvable knitr child leaves the chunk inline', async() => {
		const dir = fs.mkdtempSync(path.join(tmp, 'p-'));
		fs.writeFileSync(path.join(dir, 'p.Rmd'), '```{r child="missing.Rmd"}\n```\n```{r}\nx <- 1\n```\n');
		const analyzer = await analyze(parser, 'file://' + dir);
		assert.isDefined(await analyzer.dataflow());
	});
}));
