import type { WidgetProps } from "widgets/BaseWidget";
import type { DSLWidget } from "WidgetProvider/constants";

export const migrateMapWidgetIsClickedMarkerCentered = (
  currentDSL: DSLWidget,
) => {
  currentDSL.children = currentDSL.children?.map((child: WidgetProps) => {
    if (child.type === "MAP_WIDGET") {
      if (!("isClickedMarkerCentered" in child)) {
        child.isClickedMarkerCentered = true;
      }
    } else if (child.children && child.children.length > 0) {
      child = migrateMapWidgetIsClickedMarkerCentered(child);
    }
    return child;
  });
  return currentDSL;
};
