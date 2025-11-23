import { registerFaqs } from './data/faq/faqs';
import { WikiMaker } from './wiki-mk/wiki-maker';

/**
 * https://github.com/flowr-analysis/flowr/wiki/FAQ
 */
export class WikiFaq extends WikiMaker {
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

