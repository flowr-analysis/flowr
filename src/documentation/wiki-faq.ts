import { autoGenHeader } from './doc-util/doc-auto-gen';
import { registerFaqs } from './data/faq/faqs';
import { WikiMaker } from './wiki-mk/wiki-maker';

/**
 * https://github.com/flowr-analysis/flowr/wiki/FAQ
 */
export class WikiFaq extends WikiMaker {
	constructor() {
		super('wiki/FAQ.md');
	}

	public text(): string {
		const faqs = registerFaqs();
		return `${autoGenHeader({ filename: module.filename, purpose: 'frequently asked questions' })}
	
	${faqs.toMarkdown()}

    `.trim();
	}
}

