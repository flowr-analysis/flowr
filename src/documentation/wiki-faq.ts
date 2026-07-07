import { registerFaqs } from './data/faq/faqs';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

/**
 * https://github.com/flowr-analysis/flowr/wiki/FAQ
 */
export class WikiFaq extends DocMaker<'wiki/FAQ.md'> {
	constructor() {
		super('wiki/FAQ.md', module.filename, 'frequently asked questions');
	}

	public text({ ctx }: DocMakerArgs): string {
		const faqs = registerFaqs(ctx);
		return `
	${faqs.toMarkdown()}
    `.trim();
	}
}

