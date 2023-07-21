import type { AppState } from "@appsmith/reducers";
import { EditorContext } from "components/editorComponents/EditorContextProvider";
import type { DimensionUpdateProps } from "components/editorComponents/WidgetResizer/resizable/common";
import { isEmpty } from "lodash";
import log from "loglevel";
import { useContext, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { ReflowDirection } from "reflow/reflowTypes";
import { getWidget } from "sagas/selectors";
import {
  getAutoLayoutParentCanvasMetaWidth,
  getLayerInformation,
} from "selectors/autoLayoutSelectors";
import { getMainCanvasProps } from "selectors/editorSelectors";
import { FlexLayerAlignment } from "utils/autoLayout/constants";
import type { MinMaxSize } from "utils/autoLayout/flexWidgetUtils";
import { getWidgetMinMaxDimensionsInPixel } from "utils/autoLayout/flexWidgetUtils";
import { useWidgetDragResize } from "utils/hooks/dragResizeHooks";
import { WidgetOperations } from "widgets/BaseWidget";

export const HANDLE_WIDTH = 10;

type Handle = {
  left: number;
  top: number;
  height: number;
  width: number;
  direction: ReflowDirection;
  dragCallback?: any;
  cursor: string;
  resizeDot?: boolean;
};

export const useAutoLayoutResizable = (
  selectedWidgetsData:
    | { id: string; widgetName: string; position: any }[]
    | undefined,
  containerRef: HTMLDivElement | null,
  canvasPositions: {
    top: number;
    left: number;
    xDiff: number;
    width: number;
    yDiff: number;
    height: number;
  },
  scrollTop: number,
  updateSelectedWidgetPositions: (widgetPosition?: any) => void,
) => {
  // if (
  //   !selectedWidgetsData?.length ||
  //   selectedWidgetsData.length > 1 ||
  //   !containerRef
  // )
  //   return {};

  const resizeDirection = useRef<ReflowDirection | undefined>(undefined);

  const { setIsResizing } = useWidgetDragResize();

  const isResizing = useSelector(
    (state: AppState) => state.ui.widgetDragResize.isResizing,
  );

  const { updateWidget } = useContext(EditorContext);

  const startPoints = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { id, position } =
    selectedWidgetsData?.length === 1 && selectedWidgetsData[0]
      ? selectedWidgetsData[0]
      : { id: "", position: { left: 0, top: 0, height: 0, width: 0 } };

  const selectedWidget = useSelector((state: AppState) => getWidget(state, id));

  const parentWidth = useSelector(getAutoLayoutParentCanvasMetaWidth(id));

  const mainCanvasProps = useSelector(getMainCanvasProps);
  const {
    computedAlignment,
    hasFillChild,

    layerWidthInPixelsWithoutCurrWidget,
  } = useSelector(getLayerInformation(id));

  const widgetElement = useRef<HTMLDivElement | null>(null);

  const initialDimensions = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({
    ...position,
  });

  const [handlePositions, setHandlePositions] = useState<{
    [direction: string]: Handle;
  }>({});

  const handlePositionsRef = useRef<{
    [direction: string]: Handle;
  }>({});

  const { minWidth }: { [key in keyof MinMaxSize]: number | undefined } =
    getWidgetMinMaxDimensionsInPixel(
      { type: selectedWidget?.type },
      mainCanvasProps.width || 1,
    );

  const minWidthPercentage = ((minWidth || 0) * 100) / parentWidth;

  const widgetAlignment = hasFillChild
    ? computedAlignment
    : selectedWidget?.alignment || FlexLayerAlignment.Start;

  useEffect(() => {
    if (!resizeDirection.current) {
      initialDimensions.current = { ...position };
      const tempHandlePositions = getHandlePositionsFromPosition();
      setHandlePositions(tempHandlePositions);
      handlePositionsRef.current = tempHandlePositions;
    }
  }, [position, resizeDirection.current]);

  useEffect(() => {
    if (selectedWidgetsData?.length === 1 && selectedWidgetsData[0]) {
      widgetElement.current = document.getElementById(
        `t--draggable-${selectedWidgetsData[0].id}`,
      ) as HTMLDivElement;
    } else {
      widgetElement.current = null;
    }
  }, [selectedWidgetsData]);

  // const [newDimensions, set] = useState<DimensionUpdateProps>({
  //   width: 0,
  //   height: position?.height || 0,
  //   x: 0,
  //   y: 0,
  //   reset: false,
  //   direction: ReflowDirection.UNSET,
  //   reflectDimension: true,
  //   reflectPosition: true,
  // });

  const newDimensions = useRef<DimensionUpdateProps>({
    width: 0,
    height: position?.height || 0,
    x: 0,
    y: 0,
    reset: false,
    direction: ReflowDirection.UNSET,
    reflectDimension: true,
    reflectPosition: true,
  });

  const setNewDimensions = (rect: DimensionUpdateProps) => {
    const canResize = true;
    if (canResize) {
      let newRect = { ...rect };
      // ToDo(Ashok): need to add limits

      const widgetWidthInPixels = initialDimensions.current.width;

      const layerWidthInPixels =
        layerWidthInPixelsWithoutCurrWidget + widgetWidthInPixels;
      const hasReachedMaxWidthLimit = !(
        layerWidthInPixels < parentWidth &&
        layerWidthInPixels + rect.width <= parentWidth
      );
      const isIncreasingWidth = newRect.width > 0;
      const setMaxLimitAsWidth = hasReachedMaxWidthLimit && isIncreasingWidth;

      const hasReachedMimWidthLimit =
        widgetWidthInPixels + rect.width <= (minWidth || 0);
      const setMinLimitAsWidth = !isIncreasingWidth && hasReachedMimWidthLimit;
      const minWidthDiff = Math.max(widgetWidthInPixels - (minWidth || 0), 0);
      if (setMaxLimitAsWidth) {
        const maxWidthDiff = parentWidth - layerWidthInPixels;
        newRect = {
          ...newRect,
          width: maxWidthDiff,
          x: maxWidthDiff,
          X: maxWidthDiff,
        };
      } else if (setMinLimitAsWidth) {
        newRect = {
          ...newRect,
          width: -minWidthDiff,
          x: -minWidthDiff,
          X: -minWidthDiff,
        };
      } else {
        //if it should not resize horizontally, we keep keep the previous horizontal dimensions
        if (hasFillChild) {
          newRect = {
            ...newRect,
            width: newDimensions.current.width,
            x: newDimensions.current.x,
            X: newDimensions.current.X,
          };
        }
      }

      updateWidgetDimensions(newRect || { X: 0, Y: 0 });
      log.debug("resizable", newRect);

      newDimensions.current = newRect;
    }
  };

  function updateWidgetDimensions(newRect: { X?: number; Y?: number }) {
    const newPositions = getCalculatedWidgetDimensions(
      newRect,
      initialDimensions.current,
    );

    if (!widgetElement.current) return;

    log.debug("resizable child", newPositions);
    widgetElement.current.style.width = newPositions.width + "px";
    widgetElement.current.style.height = newPositions.height + "px";

    updateSelectedWidgetPositions(newPositions);
  }

  useEffect(() => {
    const onMouseDown = (e: any) => {
      const mousePosition = getPositionsRelativeToContainer(
        e,
        canvasPositions,
        scrollTop,
      );
      const handle = getHandleBasedOnMousePosition(
        handlePositionsRef.current,
        mousePosition,
      );

      if (handle) {
        resizeDirection.current = handle;
        startPoints.current = getPositionsRelativeToContainer(
          e,
          canvasPositions,
          scrollTop,
        );

        setIsResizing && !isResizing && setIsResizing(true);
      }
    };

    const onMouseUp = () => {
      if (resizeDirection.current && selectedWidget) {
        resizeDirection.current = undefined;
        startPoints.current = { x: 0, y: 0 };

        const widthChange = (newDimensions.current.width * 100) / parentWidth;

        const existingWidgetWidth =
          (initialDimensions.current.width * 100) / parentWidth;

        const newlyComputedWidth = Math.min(
          Math.max(
            (selectedWidget.width || existingWidgetWidth) + widthChange,
            minWidthPercentage,
          ),
          100,
        );

        updateWidget &&
          updateWidget(WidgetOperations.RESIZE, id, {
            width: newlyComputedWidth,
            height: newDimensions.current.height || 0,
            parentId: selectedWidget.parentId,
          });

        newDimensions.current = {
          width: 0,
          height: position?.height || 0,
          x: 0,
          y: 0,
          reset: false,
          direction: ReflowDirection.UNSET,
          reflectDimension: true,
          reflectPosition: true,
        };

        if (widgetElement?.current) {
          widgetElement.current.style.height = "100%";
          widgetElement.current.style.width = "100%";
        }
        setIsResizing && setIsResizing(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeDirection.current || !widgetElement.current) return;

      const currentHandle = handlePositionsRef.current[resizeDirection.current];
      const mousePosition = getPositionsRelativeToContainer(
        e,
        canvasPositions,
        scrollTop,
      );

      currentHandle.dragCallback &&
        currentHandle.dragCallback(
          mousePosition.x - startPoints.current.x,
          mousePosition.y - startPoints.current.y,
        );
    };

    containerRef?.addEventListener("mousedown", onMouseDown);
    containerRef?.addEventListener("mousemove", onMouseMove);
    containerRef?.addEventListener("mouseup", onMouseUp);

    () => {
      containerRef?.removeEventListener("mousedown", onMouseDown);
      containerRef?.removeEventListener("mousemove", onMouseMove);
      containerRef?.removeEventListener("mouseup", onMouseUp);
    };
  }, [containerRef, parentWidth]);

  function getHandlePositionsFromPosition() {
    const handlePositions: { [direction: string]: Handle } = {};

    const {
      height,
      left,
      top: canvasTop,
      width,
    } = !isEmpty(initialDimensions.current)
      ? initialDimensions.current
      : position || {};

    const top = canvasTop + canvasPositions.yDiff;

    handlePositions[ReflowDirection.LEFT] = {
      left: left - HANDLE_WIDTH / 2,
      top: top + HANDLE_WIDTH / 2,
      width: HANDLE_WIDTH,
      height: height - HANDLE_WIDTH,
      cursor: "col-resize",
      direction: ReflowDirection.LEFT,
      resizeDot: true,
      dragCallback: (x: number) => {
        let dimensionUpdates = {
          reflectDimension: true,
          reflectPosition: false,
          y: newDimensions.current.y,
          direction: ReflowDirection.LEFT,
          X: x,
          height: newDimensions.current.height,
          width: width,
          x: x,
        };
        if (widgetAlignment === "start") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -x,
            x: 0,
          };
        } else if (widgetAlignment === "center") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -2 * x,
            x: 0,
            reflectDimension: true,
            reflectPosition: true,
          };
        } else {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -x,
            x,
          };
        }
        setNewDimensions(dimensionUpdates);
      },
    };
    handlePositions[ReflowDirection.RIGHT] = {
      left: left + width - HANDLE_WIDTH / 2,
      top: top + HANDLE_WIDTH / 2,
      width: HANDLE_WIDTH,
      height: height - HANDLE_WIDTH,
      cursor: "col-resize",
      direction: ReflowDirection.RIGHT,
      resizeDot: true,
      dragCallback: (x: number) => {
        let dimensionUpdates = {
          reflectDimension: true,
          reflectPosition: false,
          y: newDimensions.current.y,
          direction: ReflowDirection.RIGHT,
          X: x,
          height: newDimensions.current.height,
          width: width,
          x: x,
        };
        if (widgetAlignment === "start") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: x,
            x: 0,
          };
        } else if (widgetAlignment === "center") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: 2 * x,
            x: 0,
            reflectDimension: true,
            reflectPosition: true,
          };
        } else {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: x,
            x: 0,
          };
        }
        setNewDimensions(dimensionUpdates);
      },
    };
    handlePositions[ReflowDirection.BOTTOM] = {
      left: left + HANDLE_WIDTH / 2,
      top: top + height - HANDLE_WIDTH / 2,
      height: HANDLE_WIDTH,
      width: width - HANDLE_WIDTH,
      cursor: "row-resize",
      direction: ReflowDirection.BOTTOM,
      resizeDot: true,
      dragCallback: (x: number, y: number) => {
        setNewDimensions({
          width: newDimensions.current.width,
          height: height + y,
          x: newDimensions.current.x,
          y: newDimensions.current.y,
          direction: ReflowDirection.BOTTOM,
          Y: y,
          reflectDimension: true,
          reflectPosition: true,
        });
      },
    };

    handlePositions[ReflowDirection.BOTTOMLEFT] = {
      left: left - HANDLE_WIDTH / 2,
      top: top + height - HANDLE_WIDTH / 2,
      width: HANDLE_WIDTH,
      height: HANDLE_WIDTH,
      cursor: "sw-resize",
      direction: ReflowDirection.BOTTOMLEFT,
      dragCallback: (x: number, y: number) => {
        let dimensionUpdates = {
          reflectDimension: true,
          reflectPosition: false,
          x: x,
          width: width - x,
          height: height + y,
          y: newDimensions.current.y,
          direction: ReflowDirection.BOTTOMLEFT,
          X: x,
          Y: y,
        };

        if (widgetAlignment === "start") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -x,
            x: 0,
          };
        } else if (widgetAlignment === "center") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -2 * x,
            x: 0,
            reflectDimension: true,
            reflectPosition: true,
          };
        } else {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: -x,
            x,
          };
        }
        setNewDimensions(dimensionUpdates);
      },
    };
    handlePositions[ReflowDirection.BOTTOMRIGHT] = {
      left: left + width - HANDLE_WIDTH / 2,
      top: top + height - HANDLE_WIDTH / 2,
      width: HANDLE_WIDTH,
      height: HANDLE_WIDTH,
      cursor: "se-resize",
      direction: ReflowDirection.BOTTOMRIGHT,
      dragCallback: (x: number, y: number) => {
        let dimensionUpdates = {
          reflectDimension: true,
          reflectPosition: false,
          y: newDimensions.current.y,
          width: width + x,
          height: height + y,
          x: newDimensions.current.x,
          direction: ReflowDirection.BOTTOMRIGHT,
          X: x,
          Y: y,
        };

        if (widgetAlignment === "start") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: x,
            x: 0,
          };
        } else if (widgetAlignment === "center") {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: 2 * x,
            x: 0,
            reflectDimension: true,
            reflectPosition: true,
          };
        } else {
          dimensionUpdates = {
            ...dimensionUpdates,
            width: x,
            x: 0,
          };
        }
        setNewDimensions(dimensionUpdates);
      },
    };

    return handlePositions;
  }

  return handlePositions;
};

function getHandleBasedOnMousePosition(
  handlePositions: { [direction: string]: Handle },
  mousePosition: { x: number; y: number },
) {
  const handlePositionsList = Object.values(handlePositions);

  const { x, y } = mousePosition;

  for (const handlePosition of handlePositionsList) {
    const { direction, height, left, top, width } = handlePosition;

    if (x > left && x < left + width && y > top && y < top + height) {
      return direction;
    }
  }

  return;
}

function getPositionsRelativeToContainer(
  e: any,
  canvasPositions: {
    top: number;
    left: number;
    xDiff: number;
    width: number;
    yDiff: number;
    height: number;
  },
  scrollTop: number,
): { x: number; y: number } {
  const x = e.clientX - canvasPositions.left - canvasPositions.xDiff;
  const y = e.clientY - canvasPositions.top - scrollTop;

  return { x, y };
}

function getCalculatedWidgetDimensions(
  rect: { X?: number; Y?: number },
  initialDimensions: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
) {
  return {
    left: initialDimensions.left,
    top: initialDimensions.top,
    width: initialDimensions.width + (rect.X || 0),
    height: initialDimensions.height + (rect.Y || 0),
  };
}