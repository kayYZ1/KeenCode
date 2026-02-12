import Y from "yoga-layout";
import { drawBox } from "@/tui/core/primitives/draw-box.ts";
import type { BoxInstance, ElementHandler, Position } from "../types/index.ts";
import type { LayoutHandler } from "./index.ts";

const FLEX_DIRECTION_MAP = {
	row: Y.FLEX_DIRECTION_ROW,
	column: Y.FLEX_DIRECTION_COLUMN,
	"row-reverse": Y.FLEX_DIRECTION_ROW_REVERSE,
	"column-reverse": Y.FLEX_DIRECTION_COLUMN_REVERSE,
} as const;

const JUSTIFY_CONTENT_MAP = {
	"flex-start": Y.JUSTIFY_FLEX_START,
	center: Y.JUSTIFY_CENTER,
	"flex-end": Y.JUSTIFY_FLEX_END,
	"space-between": Y.JUSTIFY_SPACE_BETWEEN,
	"space-around": Y.JUSTIFY_SPACE_AROUND,
	"space-evenly": Y.JUSTIFY_SPACE_EVENLY,
} as const;

const ALIGN_ITEMS_MAP = {
	"flex-start": Y.ALIGN_FLEX_START,
	center: Y.ALIGN_CENTER,
	"flex-end": Y.ALIGN_FLEX_END,
	stretch: Y.ALIGN_STRETCH,
	baseline: Y.ALIGN_BASELINE,
} as const;

export const BoxLayout: LayoutHandler<BoxInstance> = (instance) => {
	const { yogaNode, props } = instance;
	if (props.flex) yogaNode.setFlex(Number(props.flex));
	if (props.flexDirection) yogaNode.setFlexDirection(FLEX_DIRECTION_MAP[props.flexDirection]);
	if (props.justifyContent) yogaNode.setJustifyContent(JUSTIFY_CONTENT_MAP[props.justifyContent]);
	if (props.alignItems) yogaNode.setAlignItems(ALIGN_ITEMS_MAP[props.alignItems]);
	if (props.gap) {
		const isRow = props.flexDirection === "row" || props.flexDirection === "row-reverse";
		yogaNode.setGap(isRow ? Y.GUTTER_COLUMN : Y.GUTTER_ROW, props.gap);
	}
	if (props.padding) yogaNode.setPadding(Y.EDGE_ALL, props.padding);
	if (props.height) yogaNode.setHeight(props.height);
	if (props.width) yogaNode.setWidth(props.width);
	if (props.border) yogaNode.setBorder(Y.EDGE_ALL, 1);
	yogaNode.setPositionType(props.position === "absolute" ? Y.POSITION_TYPE_ABSOLUTE : Y.POSITION_TYPE_RELATIVE);
	if (props.top !== undefined) yogaNode.setPosition(Y.EDGE_TOP, props.top);
	if (props.left !== undefined) yogaNode.setPosition(Y.EDGE_LEFT, props.left);
	if (props.right !== undefined) yogaNode.setPosition(Y.EDGE_RIGHT, props.right);
	if (props.bottom !== undefined) yogaNode.setPosition(Y.EDGE_BOTTOM, props.bottom);
};

export const BoxElement: ElementHandler<BoxInstance> = (instance, context): Position[] => {
	const x = context.parentX + Math.round(instance.yogaNode.getComputedLeft());
	const y = context.parentY + Math.round(instance.yogaNode.getComputedTop());
	const positions: Position[] = [];

	if (instance.props.border) {
		const w = Math.round(instance.yogaNode.getComputedWidth());
		const h = Math.round(instance.yogaNode.getComputedHeight());
		positions.push(
			...drawBox(
				x,
				y,
				w,
				h,
				instance.props.border,
				instance.props.borderColor,
				instance.props.borderLabel,
				instance.props.borderLabelColor,
			),
		);
	}

	positions.push(...instance.children.flatMap((child) => context.renderInstance(child, x, y)));

	return positions;
};
