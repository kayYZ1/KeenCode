import process from "node:process";
import { effect } from "@preact/signals-core";
import Y from "yoga-layout";
import { inputManager } from "../core/input.ts";
import { Terminal } from "../core/terminal.ts";
import { onExit, registerTerminal } from "../dev/index.ts";
import { ElementType, getElement } from "./elements/index.ts";
import { clearPendingCursor, getPendingCursor } from "./elements/text-input.ts";
import { cleanupEffects, nextComponent, resetHooks } from "./hooks/signals.ts";
import type { VNode } from "./jsx-runtime.ts";
import type { Instance, Position, RenderContext } from "./types/index.ts";

export class Renderer {
	terminal: Terminal;
	rootInstance: Instance | null = null;
	disposeEffect: (() => void) | null = null;

	constructor(terminal: Terminal) {
		this.terminal = terminal;
	}

	renderInstance(instance: Instance, parentX = 0, parentY = 0): Position[] {
		const context: RenderContext = {
			parentX: Math.round(parentX),
			parentY: Math.round(parentY),
			renderInstance: this.renderInstance.bind(this),
		};

		const { render } = getElement(instance.type);
		return render(instance, context);
	}

	freeYogaNodes(instance: Instance) {
		for (const child of instance.children) {
			this.freeYogaNodes(child);
		}
		instance.yogaNode.free();
	}

	createInstanceTree(vnode: VNode): Instance {
		if (typeof vnode.type === "function") {
			nextComponent();
			const childVNode = (vnode.type as any)(vnode.props);
			return this.createInstanceTree(childVNode);
		}

		const type = typeof vnode.type === "string" ? vnode.type : ElementType.BOX;
		const element = getElement(type);

		const instance = {
			type,
			props: vnode.props,
			children: [] as Instance[],
			yogaNode: Y.Node.create(),
		} as Instance;

		element.layout(instance);

		if (element.hasChildren) {
			const rawChildren = Array.isArray(vnode.props.children)
				? vnode.props.children
				: [vnode.props.children].filter(Boolean);

			const children = rawChildren.flat(Infinity);

			for (const child of children) {
				if (typeof child === "string" || typeof child === "number") {
					const textElement = getElement(ElementType.TEXT);
					const childInstance: Instance = {
						type: ElementType.TEXT,
						props: { children: child.toString() },
						children: [],
						yogaNode: Y.Node.create(),
					};
					textElement.layout(childInstance);
					instance.children.push(childInstance);
					instance.yogaNode.insertChild(childInstance.yogaNode, instance.children.length - 1);
				} else if (child && typeof child === "object" && child.type) {
					const childInstance = this.createInstanceTree(child);
					instance.children.push(childInstance);
					instance.yogaNode.insertChild(childInstance.yogaNode, instance.children.length - 1);
				}
			}
		}

		return instance;
	}

	commitRender(vnode: VNode) {
		if (this.rootInstance) {
			this.freeYogaNodes(this.rootInstance);
		}
		clearPendingCursor();

		this.rootInstance = this.createInstanceTree(vnode);
		this.rootInstance.yogaNode.setWidth(this.terminal.width);
		this.rootInstance.yogaNode.setHeight(this.terminal.height);
		this.rootInstance.yogaNode.calculateLayout(this.terminal.width, this.terminal.height, Y.DIRECTION_LTR);

		this.terminal.render(this.renderInstance(this.rootInstance, 0, 0));

		const cursor = getPendingCursor();
		if (cursor?.visible) {
			this.terminal.setCursorPosition(cursor.x, cursor.y);
			this.terminal.setCursorStyle(cursor.style ?? "bar");
			this.terminal.showCursor();
		} else {
			this.terminal.hideCursor();
		}
	}

	render(createVNode: () => VNode) {
		this.disposeEffect = effect(() => {
			resetHooks();
			this.commitRender(createVNode());
		});
	}

	unmount() {
		if (this.disposeEffect) {
			this.disposeEffect();
			this.disposeEffect = null;
		}
		if (this.rootInstance) {
			this.freeYogaNodes(this.rootInstance);
			this.rootInstance = null;
		}
		cleanupEffects();
		this.terminal.dispose();
	}
}

export function render(createVNode: () => VNode, terminal: Terminal) {
	const renderer = new Renderer(terminal);
	renderer.render(createVNode);
	return {
		rerender: () => renderer.render(createVNode),
		unmount: () => renderer.unmount(),
	};
}

export function run(createVNode: () => VNode) {
	const terminal = new Terminal();
	const { unmount } = render(createVNode, terminal);

	registerTerminal(terminal);
	inputManager.start();

	const cleanup = inputManager.onKeyGlobal((event) => {
		if (event.ctrl && event.key === "c") {
			onExit();
			cleanup();
			inputManager.stop();
			unmount();
			process.exit();
		}
		return false;
	});

	return {
		unmount: () => {
			onExit();
			cleanup();
			inputManager.stop();
			unmount();
		},
		terminal,
	};
}
