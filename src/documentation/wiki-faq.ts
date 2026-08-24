import { registerFaqs } from './data/faq/faqs';
import { NewQuestionUrl } from './doc-util/doc-issue';
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
Is your question not answered below? Please [ask it as an issue](${NewQuestionUrl}) and we will answer it.
Answers regularly end up on this page, so asking helps everyone who wonders the same thing later.

	${faqs.toMarkdown()}
    `.trim();
	}
}

