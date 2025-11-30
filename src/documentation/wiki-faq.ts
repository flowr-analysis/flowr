import { registerFaqs } from './data/faq/faqs';
import { DocMaker } from './wiki-mk/doc-maker';

/**
 * https://github.com/flowr-analysis/flowr/wiki/FAQ
 */
export class WikiFaq extends DocMaker {
	constructor() {
		super('wiki/FAQ.md', module.filename, 'frequently asked questions');
	}

	public text(): string {
		const faqs = registerFaqs();
		return `
	${faqs.toMarkdown()}
    `.trim();
	}
}

