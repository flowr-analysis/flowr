
/** a new element with its class and text set in one line, the two properties most creations want */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if(className) {
		node.className = className;
	}
	if(text !== undefined) {
		node.textContent = text;
	}
	return node;
}

/** opens `link` in a new tab, safely: the target/rel pair every outbound link sets */
export function blank<T extends HTMLAnchorElement>(link: T): T {
	link.target = '_blank';
	link.rel = 'noopener';
	return link;
}

/** a plain button, with what it does said on hover */
export function button(className: string | undefined, text: string, title: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
	const node = el('button', className, text);
	node.type = 'button';
	node.title = title;
	node.addEventListener('click', onClick);
	return node;
}
