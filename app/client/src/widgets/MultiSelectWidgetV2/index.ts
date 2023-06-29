import { Alignment } from "@blueprintjs/core";
import { LabelPosition } from "components/constants";
import { FILL_WIDGET_MIN_WIDTH } from "constants/minWidthConstants";
import { ResponsiveBehavior } from "utils/autoLayout/constants";
import { DynamicHeight } from "utils/WidgetFeatures";
import type { WidgetProps } from "widgets/BaseWidget";
import { BlueprintOperationTypes } from "widgets/constants";
import {
  defaultValueExpressionPrefix,
  getDefaultValueExpressionSuffix,
} from "./constants";

import IconSVG from "./icon.svg";
import Widget from "./widget";

export const CONFIG = {
  features: {
    dynamicHeight: {
      sectionIndex: 4,
      defaultValue: DynamicHeight.FIXED,
      active: true,
    },
  },
  type: Widget.getWidgetType(),
  name: "MultiSelect",
  iconSVG: IconSVG,
  needsMeta: true,
  searchTags: ["dropdown", "tags"],
  defaults: {
    rows: 7,
    columns: 20,
    animateLoading: true,
    labelText: "Label",
    labelPosition: LabelPosition.Top,
    labelAlignment: Alignment.LEFT,
    labelWidth: 5,
    labelTextSize: "0.875rem",
    sourceData: [
      { name: "Blue", code: "BLUE" },
      { name: "Green", code: "GREEN" },
      { name: "Red", code: "RED" },
    ],
    optionLabel: "name",
    optionValue: "code",
    widgetName: "MultiSelect",
    isFilterable: true,
    serverSideFiltering: false,
    defaultOptionValue: ["GREEN", "RED"],
    version: 1,
    isRequired: false,
    isDisabled: false,
    placeholderText: "Select option(s)",
    responsiveBehavior: ResponsiveBehavior.Fill,
    minWidth: FILL_WIDGET_MIN_WIDTH,
    // blueprint: {
    //   operations: [
    //     {
    //       type: BlueprintOperationTypes.MODIFY_PROPS,
    //       fn: (widget: WidgetProps) => {
    //         return [
    //           {
    //             widgetId: widget.widgetId,
    //             propertyName: "defaultOptionValue",
    //             propertyValue: `${defaultValueExpressionPrefix}["GREEN", "RED"]${getDefaultValueExpressionSuffix(
    //               widget,
    //             )}`,
    //           },
    //           {
    //             widgetId: widget.widgetId,
    //             propertyName: "dynamicBindingPathList",
    //             propertyValue: widget.dynamicBindingPathList?.concat([
    //               { key: "defaultOptionValue" },
    //             ]),
    //           },
    //         ];
    //       },
    //     },
    //   ],
    // },
  },

  properties: {
    derived: Widget.getDerivedPropertiesMap(),
    default: Widget.getDefaultPropertiesMap(),
    meta: Widget.getMetaPropertiesMap(),
    config: Widget.getPropertyPaneConfig(),
    contentConfig: Widget.getPropertyPaneContentConfig(),
    styleConfig: Widget.getPropertyPaneStyleConfig(),
    stylesheetConfig: Widget.getStylesheetConfig(),
    autocompleteDefinitions: Widget.getAutocompleteDefinitions(),
  },
  autoLayout: {
    disabledPropsDefaults: {
      labelPosition: LabelPosition.Top,
      labelTextSize: "0.875rem",
    },
    defaults: {
      rows: 6.6,
    },
    autoDimension: {
      height: true,
    },
    widgetSize: [
      {
        viewportMinWidth: 0,
        configuration: () => {
          return {
            minWidth: "160px",
          };
        },
      },
    ],
    disableResizeHandles: {
      vertical: true,
    },
  },
};

export default Widget;
