import { type BaseInstance, type ElementHandler, ElementType } from "../types/index.ts";
import { BoxElement, BoxLayout } from "./box.ts";
import { SpinnerElement, SpinnerLayout } from "./spinner.ts";
import { TextElement, TextLayout } from "./text.ts";
import { ScrollAreaElement, ScrollAreaLayout } from "./scroll-area.ts";
import { TextInputElement, TextInputLayout } from "./text-input.ts";

/** Layout function applies Yoga properties to an instance */
export type LayoutHandler<T extends BaseInstance = BaseInstance> = (instance: T) => void;

/** Export ElementType here for clarity */
export { ElementType };

interface ElementDefinition {
	render: ElementHandler<any>;
	layout: LayoutHandler<any>;
	/** If true, children are processed (like box). If false, children stay in props (like text) */
	hasChildren: boolean;
}

const elements = new Map<string, ElementDefinition>();

/** Register a new element type */
export function registerElement(
	type: string,
	definition: {
		render: ElementHandler<any>;
		layout: LayoutHandler<any>;
		hasChildren?: boolean;
	},
): void {
	elements.set(type, {
		render: definition.render,
		layout: definition.layout,
		hasChildren: definition.hasChildren ?? true,
	});
}

/** Get element definition by type */
export function getElement(type: string): ElementDefinition {
	const element = elements.get(type);
	if (!element) {
		throw new Error(`No element registered for type: ${type}`);
	}
	return element;
}

/** Check if element type is registered */
export function hasElement(type: string): boolean {
	return elements.has(type);
}

// Register built-in elements
registerElement(ElementType.BOX, {
	render: BoxElement,
	layout: BoxLayout,
	hasChildren: true,
});

registerElement(ElementType.TEXT, {
	render: TextElement,
	layout: TextLayout,
	hasChildren: false,
});

registerElement(ElementType.TEXT_INPUT, {
	render: TextInputElement,
	layout: TextInputLayout,
	hasChildren: false,
});

registerElement(ElementType.SPINNER, {
	render: SpinnerElement,
	layout: SpinnerLayout,
	hasChildren: false,
});

registerElement(ElementType.SCROLL_AREA, {
	render: ScrollAreaElement,
	layout: ScrollAreaLayout,
	hasChildren: true,
});

export { BoxElement, ScrollAreaElement, SpinnerElement, TextElement, TextInputElement };
