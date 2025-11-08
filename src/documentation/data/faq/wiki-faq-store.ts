import { collapsibleToc, details, section } from '../../doc-util/doc-structure';
import { DefaultMap } from '../../../util/collections/defaultmap';
import { guard } from '../../../util/assert';

const FlowrFaqTopics = {
	'flowr.use':         '✨ Using <i>flowR</i>',
	'flowr.development': '🧑‍💻 <i>flowR</i> Development',
	'r.packages':        '📦 R Packages'
} as const;

type Topic = keyof typeof FlowrFaqTopics;
/**
 * Manage all questions and answers by topic.
 */
export class FaqStore {
	private faqs:      DefaultMap<Topic, [question: string, answer: string][]> = new DefaultMap(() => []);
	private currTopic: Topic | undefined = undefined;

	withTopic(topic: Topic): this {
		this.currTopic = topic;
		return this;
	}

	addFaq(question: string, answer: string): this {
		guard(this.currTopic !== undefined, 'Current topic is not set use withTopic first');
		question = question.replace(/\*([^*]+)\*/g, '<b>$1</b>');
		const store = this.faqs.get(this.currTopic);
		if(store.find(([q]) => q === question)) {
			throw new Error(`FAQ for question "${question}" in topic "${this.currTopic}" already exists`);
		}
		store.push([question, answer]);
		return this;
	}

	private printAllTopics(topicsRegex: RegExp): string {
		const topics = Array.from(this.faqs.keys())
			.filter(topic => topicsRegex.test(topic))
			.sort((a, b) => a.localeCompare(b));
		let output = '';
		for(const topic of topics) {
			const faqs = this.faqs.get(topic).sort(
				([q1], [q2]) => q1.localeCompare(q2)
			);
			if(faqs.length === 0) {
				continue;
			}

			output += section(FlowrFaqTopics[topic], 3) + '\n\n';
			for(const [question, answer] of faqs) {
				output += qAndA(question, answer) + '\n\n';
			}
		}
		return output;
	}

	toMarkdown(): string {
		return `
${collapsibleToc({
	['💮 *flowR* FAQ']: {
		[FlowrFaqTopics['flowr.development']]: {},
		[FlowrFaqTopics['flowr.use']]:         {}
	},
	['🇷 R FAQ']: {
		[FlowrFaqTopics['r.packages']]: {}
	}
})}

${section('💮 <i>flowR</i> FAQ', 2)}

${this.printAllTopics(/^flowr.*$/)}

${section('🇷 R FAQ', 2)}

${this.printAllTopics(/^r.*$/)}  
		`;
	}

}

function qAndA(question: string, answer: string): string {
	return details(question.trim(), answer.trim(), { hideIfEmpty: true });
}
