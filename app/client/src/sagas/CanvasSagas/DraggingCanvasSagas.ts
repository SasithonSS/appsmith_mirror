import { Toaster } from "components/ads/Toast";
import {
  ReduxAction,
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "@appsmith/constants/ReduxActionConstants";
import {
  CanvasWidgetsReduxState,
  FlattenedWidgetProps,
} from "reducers/entityReducers/canvasWidgetsReducer";
import { all, call, put, select, takeLatest } from "redux-saga/effects";
import log from "loglevel";
import { cloneDeep, isArray } from "lodash";
import { updateAndSaveLayout, WidgetAddChild } from "actions/pageActions";
import { calculateDropTargetRows } from "components/editorComponents/DropTargetUtils";
import {
  GridDefaults,
  MAIN_CONTAINER_WIDGET_ID,
} from "constants/WidgetConstants";
import { WidgetProps } from "widgets/BaseWidget";
import {
  getMainCanvasProps,
  getOccupiedSpacesSelectorForContainer,
} from "selectors/editorSelectors";
import { OccupiedSpace } from "constants/CanvasEditorConstants";
import { collisionCheckPostReflow } from "utils/reflowHookUtils";
import { WidgetDraggingUpdateParams } from "pages/common/CanvasArenas/hooks/useBlocksToBeDraggedOnCanvas";
import { getWidget, getWidgets } from "sagas/selectors";
import { getUpdateDslAfterCreatingChild } from "sagas/WidgetAdditionSagas";
import { MainCanvasReduxState } from "reducers/uiReducers/mainCanvasReducer";
import { CANVAS_DEFAULT_MIN_HEIGHT_PX } from "constants/AppConstants";
import AnalyticsUtil from "utils/AnalyticsUtil";
import {
  LayoutDirection,
  FlexLayerAlignment,
  ResponsiveBehavior,
} from "components/constants";
import {
  FlexLayer,
  LayerChild,
} from "components/designSystems/appsmith/autoLayout/FlexBoxComponent";
import { HighlightInfo } from "pages/common/CanvasArenas/hooks/useAutoLayoutHighlights";

export type WidgetMoveParams = {
  widgetId: string;
  leftColumn: number;
  topRow: number;
  bottomRow: number;
  rightColumn: number;
  parentId: string;
  /*
      If newParentId is different from what we have in redux store,
      then we have to delete this,
      as it has been dropped in another container somewhere.
    */
  newParentId: string;
  allWidgets: CanvasWidgetsReduxState;
  position?: number;
  useAutoLayout?: boolean;
};

export function* getCanvasSizeAfterWidgetMove(
  canvasWidgetId: string,
  movedWidgetIds: string[],
  movedWidgetsBottomRow: number,
) {
  const canvasWidget: WidgetProps = yield select(getWidget, canvasWidgetId);

  //get mainCanvas's minHeight if the canvasWidget is mianCanvas
  let mainCanvasMinHeight;
  if (canvasWidgetId === MAIN_CONTAINER_WIDGET_ID) {
    const mainCanvasProps: MainCanvasReduxState = yield select(
      getMainCanvasProps,
    );
    mainCanvasMinHeight = mainCanvasProps?.height;
  }

  if (canvasWidget) {
    const occupiedSpacesByChildren: OccupiedSpace[] | undefined = yield select(
      getOccupiedSpacesSelectorForContainer(canvasWidgetId),
    );
    const canvasMinHeight =
      mainCanvasMinHeight ||
      canvasWidget.minHeight ||
      CANVAS_DEFAULT_MIN_HEIGHT_PX;
    const newRows = calculateDropTargetRows(
      movedWidgetIds,
      movedWidgetsBottomRow,
      canvasMinHeight / GridDefaults.DEFAULT_GRID_ROW_HEIGHT - 1,
      occupiedSpacesByChildren,
      canvasWidgetId,
    );
    const rowsToPersist = Math.max(
      canvasMinHeight / GridDefaults.DEFAULT_GRID_ROW_HEIGHT - 1,
      newRows,
    );

    const originalSnapRows = canvasWidget.bottomRow - canvasWidget.topRow;

    const newBottomRow = Math.round(
      rowsToPersist * GridDefaults.DEFAULT_GRID_ROW_HEIGHT,
    );
    /* Update the canvas's rows, ONLY if it has changed since the last render */
    if (originalSnapRows !== newBottomRow) {
      // TODO(abhinav): This considers that the topRow will always be zero
      // Check this out when non canvas widgets are updating snapRows
      // erstwhile: Math.round((rows * props.snapRowSpace) / props.parentRowSpace),
      return newBottomRow;
    }
    return canvasWidget.bottomRow;
  }
}

const getBottomMostRowAfterMove = (
  draggedBlocksToUpdate: WidgetDraggingUpdateParams[],
  allWidgets: CanvasWidgetsReduxState,
) => {
  const bottomMostBlock =
    draggedBlocksToUpdate[draggedBlocksToUpdate.length - 1];
  const widget = allWidgets[bottomMostBlock.widgetId];
  const { updateWidgetParams } = bottomMostBlock;
  const widgetBottomRow =
    updateWidgetParams.payload.topRow +
    (updateWidgetParams.payload.rows || widget.bottomRow - widget.topRow);
  return widgetBottomRow;
};

function* addWidgetAndMoveWidgetsSaga(
  actionPayload: ReduxAction<{
    newWidget: WidgetAddChild;
    draggedBlocksToUpdate: WidgetDraggingUpdateParams[];
    canvasId: string;
  }>,
) {
  const start = performance.now();

  const { canvasId, draggedBlocksToUpdate, newWidget } = actionPayload.payload;
  try {
    const updatedWidgetsOnAddAndMove: CanvasWidgetsReduxState = yield call(
      addWidgetAndMoveWidgets,
      newWidget,
      draggedBlocksToUpdate,
      canvasId,
    );
    if (
      !collisionCheckPostReflow(
        updatedWidgetsOnAddAndMove,
        draggedBlocksToUpdate.map((block) => block.widgetId),
        canvasId,
      )
    ) {
      throw Error;
    }
    yield put(updateAndSaveLayout(updatedWidgetsOnAddAndMove));
    yield put({
      type: ReduxActionTypes.RECORD_RECENTLY_ADDED_WIDGET,
      payload: [newWidget.newWidgetId],
    });
    log.debug("move computations took", performance.now() - start, "ms");
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.WIDGET_OPERATION_ERROR,
      payload: {
        action: ReduxActionTypes.WIDGETS_ADD_CHILD_AND_MOVE,
        error,
      },
    });
  }
}

// function* update

function* addWidgetAndMoveWidgets(
  newWidget: WidgetAddChild,
  draggedBlocksToUpdate: WidgetDraggingUpdateParams[],
  canvasId: string,
) {
  const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
  const updatedWidgetsOnAddition: CanvasWidgetsReduxState = yield call(
    getUpdateDslAfterCreatingChild,
    { ...newWidget, widgetId: canvasId },
  );
  const bottomMostRowOnAddition = updatedWidgetsOnAddition[canvasId]
    ? updatedWidgetsOnAddition[canvasId].bottomRow
    : 0;
  const allWidgetsAfterAddition = {
    ...allWidgets,
    ...updatedWidgetsOnAddition,
  };
  const updatedWidgetsOnMove: CanvasWidgetsReduxState = yield call(
    moveAndUpdateWidgets,
    allWidgetsAfterAddition,
    draggedBlocksToUpdate,
    canvasId,
  );
  const bottomMostRowOnMove = updatedWidgetsOnMove[canvasId]
    ? updatedWidgetsOnMove[canvasId].bottomRow
    : 0;

  const bottomMostRow =
    bottomMostRowOnAddition > bottomMostRowOnMove
      ? bottomMostRowOnAddition
      : bottomMostRowOnMove;
  const updatedWidgets = {
    ...updatedWidgetsOnMove,
  };
  updatedWidgets[canvasId].bottomRow = bottomMostRow;
  return updatedWidgets;
}

function* moveAndUpdateWidgets(
  allWidgets: CanvasWidgetsReduxState,
  draggedBlocksToUpdate: WidgetDraggingUpdateParams[],
  canvasId: string,
) {
  const widgets = cloneDeep(allWidgets);
  const bottomMostRowAfterMove = getBottomMostRowAfterMove(
    draggedBlocksToUpdate,
    allWidgets,
  );
  // draggedBlocksToUpdate is already sorted based on bottomRow
  const updatedWidgets = draggedBlocksToUpdate.reduce((widgetsObj, each) => {
    return moveWidget({
      ...each.updateWidgetParams.payload,
      widgetId: each.widgetId,
      allWidgets: widgetsObj,
    });
  }, widgets);
  const movedWidgetIds = draggedBlocksToUpdate.map((a) => a.widgetId);
  const updatedCanvasBottomRow: number = yield call(
    getCanvasSizeAfterWidgetMove,
    canvasId,
    movedWidgetIds,
    bottomMostRowAfterMove,
  );
  if (updatedCanvasBottomRow) {
    const canvasWidget = updatedWidgets[canvasId];
    updatedWidgets[canvasId] = {
      ...canvasWidget,
      bottomRow: updatedCanvasBottomRow,
    };
  }
  return updatedWidgets;
}

function getParentWidgetType(
  allWidgets: CanvasWidgetsReduxState,
  widgetId: string,
) {
  const widget = allWidgets[widgetId];

  if (!widget.parentId) return "MAIN_CONTAINER";

  const containerWidget = allWidgets[widget.parentId];

  /**
   * container widget can be of type FORM_WIDGET, STATBOX_WIDGET
   */
  if (containerWidget.type !== "CONTAINER_WIDGET") {
    return containerWidget.type;
  }

  /**
   * Handling the case for list widget where we have
   * canvas2 -> container -> canvas1 -> listWidget
   */
  if (containerWidget.parentId) {
    // Take the first parent that is canvas1
    const containerParent = allWidgets[containerWidget.parentId];

    // Now take the parent of canvas1 that is listWidget
    if (containerParent.parentId) {
      const mainParent = allWidgets[containerParent.parentId];
      return mainParent.type;
    }
  }

  return containerWidget.type;
}

function* moveWidgetsSaga(
  actionPayload: ReduxAction<{
    draggedBlocksToUpdate: WidgetDraggingUpdateParams[];
    canvasId: string;
  }>,
) {
  const start = performance.now();

  const { canvasId, draggedBlocksToUpdate } = actionPayload.payload;
  try {
    const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);

    const updatedWidgetsOnMove: CanvasWidgetsReduxState = yield call(
      moveAndUpdateWidgets,
      allWidgets,
      draggedBlocksToUpdate,
      canvasId,
    );

    if (
      !collisionCheckPostReflow(
        updatedWidgetsOnMove,
        draggedBlocksToUpdate.map((block) => block.widgetId),
        canvasId,
      )
    ) {
      throw Error;
    }
    // TODO: Put this piece of code in a proper place.
    const prevParentId =
      draggedBlocksToUpdate[0].updateWidgetParams.payload.parentId;
    const prevParent = updatedWidgetsOnMove[prevParentId];

    const updatedWidgets = {
      ...updatedWidgetsOnMove,
      [prevParent.widgetId]: {
        ...prevParent,
        flexLayers: removeWidgetsFromCurrentLayers(
          updatedWidgetsOnMove,
          draggedBlocksToUpdate.map((each) => each.widgetId),
          prevParent.flexLayers,
        ),
      },
    };

    yield put(updateAndSaveLayout(updatedWidgets));

    const block = draggedBlocksToUpdate[0];

    const oldParentId = block.updateWidgetParams.payload.parentId;
    const newParentId = block.updateWidgetParams.payload.newParentId;

    const oldParentWidgetType = getParentWidgetType(allWidgets, oldParentId);
    const newParentWidgetType = getParentWidgetType(allWidgets, newParentId);

    AnalyticsUtil.logEvent("WIDGET_DRAG", {
      widgets: draggedBlocksToUpdate.map((block) => {
        const widget = allWidgets[block.widgetId];
        return {
          widgetType: widget.type,
          widgetName: widget.widgetName,
        };
      }),
      multiple: draggedBlocksToUpdate.length > 1,
      movedToNewWidget: oldParentId !== newParentId,
      source: oldParentWidgetType,
      destination: newParentWidgetType,
    });
    log.debug("move computations took", performance.now() - start, "ms");
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.WIDGET_OPERATION_ERROR,
      payload: {
        action: ReduxActionTypes.WIDGETS_MOVE,
        error,
      },
    });
  }
}

function moveWidget(widgetMoveParams: WidgetMoveParams) {
  Toaster.clear();
  const {
    allWidgets,
    bottomRow,
    leftColumn,
    newParentId,
    parentId,
    rightColumn,
    topRow,
    widgetId,
  } = widgetMoveParams;
  const stateWidget: FlattenedWidgetProps = allWidgets[widgetId];
  let widget = Object.assign({}, stateWidget);
  // Get all widgets from DSL/Redux Store
  const widgets = Object.assign({}, allWidgets);
  // Get parent from DSL/Redux Store
  const stateParent: FlattenedWidgetProps = allWidgets[parentId];
  const parent = {
    ...stateParent,
    children: [...(stateParent.children || [])],
  };
  // Update position of widget
  const updatedPosition = {
    topRow,
    bottomRow,
    leftColumn,
    rightColumn,
  };
  widget = { ...widget, ...updatedPosition };

  // Replace widget with update widget props
  widgets[widgetId] = widget;
  // If the parent has changed i.e parentWidgetId is not parent.widgetId
  if (parent.widgetId !== newParentId && widgetId !== newParentId) {
    // Remove from the previous parent

    if (parent.children && Array.isArray(parent.children)) {
      const indexOfChild = parent.children.indexOf(widgetId);
      if (indexOfChild > -1) delete parent.children[indexOfChild];
      parent.children = parent.children.filter(Boolean);
    }

    // Add to new parent

    widgets[parent.widgetId] = parent;
    const newParent = {
      ...widgets[newParentId],
      children: widgets[newParentId].children
        ? [...(widgets[newParentId].children || []), widgetId]
        : [widgetId],
    };
    widgets[widgetId].parentId = newParentId;
    widgets[newParentId] = newParent;
  }
  return widgets;
}

function* autoLayoutReorderSaga(
  actionPayload: ReduxAction<{
    movedWidgets: string[];
    parentId: string;
    direction: LayoutDirection;
    dropPayload: HighlightInfo;
  }>,
) {
  const start = performance.now();

  const {
    direction,
    dropPayload,
    movedWidgets,
    parentId,
  } = actionPayload.payload;

  const { alignment, index, isNewLayer, layerIndex } = dropPayload;

  try {
    const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
    if (!parentId || !movedWidgets || !movedWidgets.length) return;
    const updatedWidgets: CanvasWidgetsReduxState = yield call(
      reorderAutolayoutChildren,
      {
        movedWidgets,
        index,
        isNewLayer,
        parentId,
        allWidgets,
        alignment,
        direction,
        layerIndex,
      },
    );

    yield put(updateAndSaveLayout(updatedWidgets));
    log.debug("reorder computations took", performance.now() - start, "ms");
  } catch (e) {
    // console.error(e);
  }
}

function* reorderAutolayoutChildren(params: {
  movedWidgets: string[];
  index: number;
  isNewLayer: boolean;
  parentId: string;
  allWidgets: CanvasWidgetsReduxState;
  alignment: FlexLayerAlignment;
  direction: LayoutDirection;
  layerIndex?: number;
}) {
  const {
    alignment,
    allWidgets,
    direction,
    index,
    isNewLayer,
    layerIndex,
    movedWidgets,
    parentId,
  } = params;
  const widgets = Object.assign({}, allWidgets);
  if (!movedWidgets) return widgets;
  const selectedWidgets = [...movedWidgets];

  let updatedWidgets: CanvasWidgetsReduxState = updateRelationships(
    selectedWidgets,
    widgets,
    parentId,
  );

  // Update flexLayers for a vertical stack.
  if (direction === LayoutDirection.Vertical) {
    const canvas = widgets[parentId];
    if (!canvas) return widgets;
    const flexLayers = canvas.flexLayers || [];
    // Remove moved widgets from the flex layers.
    const filteredLayers = removeWidgetsFromCurrentLayers(
      widgets,
      selectedWidgets,
      flexLayers,
    );
    // Create a temporary layer from moved widgets.
    const newLayer: FlexLayer = createFlexLayer(
      selectedWidgets,
      widgets,
      alignment,
    );

    // Add the new layer to the flex layers.
    updatedWidgets = isNewLayer
      ? addNewLayer(newLayer, widgets, parentId, filteredLayers, layerIndex)
      : updateExistingLayer(
          newLayer,
          widgets,
          parentId,
          filteredLayers,
          index,
          layerIndex,
        );
  }

  // update children of the parent canvas.
  const items = [...(widgets[parentId].children || [])];
  // remove moved widgets from children
  const newItems = items.filter((item) => movedWidgets.indexOf(item) === -1);
  // calculate valid position for drop
  const pos = index > newItems.length ? newItems.length : index;
  updatedWidgets[parentId] = {
    ...updatedWidgets[parentId],
    children: [
      ...newItems.slice(0, pos),
      ...movedWidgets,
      ...newItems.slice(pos),
    ],
  };

  return updatedWidgets;
}

/**
 * For all moved widgets,
 * delete relationship with previous parent and
 * add relationship with new parent
 * @param movedWidgets
 * @param widgets
 * @param parentId
 * @returns widgets
 */

function updateRelationships(
  movedWidgets: string[],
  widgets: CanvasWidgetsReduxState,
  parentId: string,
): CanvasWidgetsReduxState {
  // Check if parent has changed
  const orphans = movedWidgets.filter(
    (item) => widgets[item].parentId !== parentId,
  );
  if (orphans && orphans.length) {
    //parent has changed
    orphans.forEach((item) => {
      // remove from previous parent
      const prevParentId = widgets[item].parentId;
      if (prevParentId !== undefined) {
        const prevParent = Object.assign({}, widgets[prevParentId]);
        if (prevParent.children && isArray(prevParent.children)) {
          const updatedPrevParent = {
            ...prevParent,
            children: prevParent.children.filter((each) => each !== item),
            flexLayers: removeWidgetsFromCurrentLayers(
              widgets,
              movedWidgets,
              prevParent.flexLayers,
            ),
          };
          widgets[prevParentId] = updatedPrevParent;
        }
      }

      // add to new parent
      widgets[item] = {
        ...widgets[item],
        parentId: parentId,
      };
    });
  }
  return widgets;
}

function addNewLayer(
  newLayer: FlexLayer,
  allWidgets: CanvasWidgetsReduxState,
  parentId: string,
  layers: FlexLayer[],
  layerIndex = 0,
): CanvasWidgetsReduxState {
  const widgets: CanvasWidgetsReduxState = Object.assign({}, allWidgets);
  const canvas = widgets[parentId];

  const pos = layerIndex > layers.length ? layers.length : layerIndex;

  const updatedCanvas = {
    ...canvas,
    flexLayers: [...layers.slice(0, pos), newLayer, ...layers.slice(pos)],
  };
  const updatedWidgets = {
    ...widgets,
    [parentId]: updatedCanvas,
  };

  return updatedWidgets;
}

function updateExistingLayer(
  newLayer: FlexLayer,
  allWidgets: CanvasWidgetsReduxState,
  parentId: string,
  layers: FlexLayer[],
  index: number,
  layerIndex = 0,
): CanvasWidgetsReduxState {
  const widgets: CanvasWidgetsReduxState = Object.assign({}, allWidgets);
  const canvas = widgets[parentId];
  if (!canvas || !newLayer) return widgets;

  let selectedLayer: FlexLayer = layers[layerIndex];
  // Calculate the number of children in the container before the selected layer.
  let childCount = 0;
  layers.forEach((layer: FlexLayer, index: number) => {
    if (index >= layerIndex) return;
    childCount += layer.children.length;
  });
  const pos = index - childCount;

  // merge the selected layer with the new layer.
  selectedLayer = {
    ...selectedLayer,
    children: [
      ...selectedLayer.children.slice(0, pos),
      ...newLayer.children,
      ...selectedLayer.children.slice(pos),
    ],
    hasFillChild: newLayer.hasFillChild || selectedLayer.hasFillChild,
  };

  const updatedCanvas = {
    ...canvas,
    flexLayers: [
      ...layers.slice(0, layerIndex),
      selectedLayer,
      ...layers.slice(layerIndex + 1),
    ],
  };

  const updatedWidgets = { ...widgets, [parentId]: updatedCanvas };
  return updatedWidgets;
}

/**
 * Remove moved widgets from current layers.
 * and update hasFillChild property.
 * Return non-empty layers.
 * @param allWidgets
 * @param movedWidgets
 * @param flexLayers
 * @returns FlexLayer[]
 */
function removeWidgetsFromCurrentLayers(
  allWidgets: CanvasWidgetsReduxState,
  movedWidgets: string[],
  flexLayers: FlexLayer[],
): FlexLayer[] {
  if (!flexLayers || !flexLayers.length) return [];
  return flexLayers?.reduce((acc: FlexLayer[], layer: FlexLayer) => {
    const children = layer.children.filter(
      (each: LayerChild) => movedWidgets.indexOf(each.id) === -1,
    );
    if (children.length) {
      acc.push({
        ...layer,
        children,
        hasFillChild: children.some(
          (each: LayerChild) =>
            allWidgets[each.id].responsiveBehavior === ResponsiveBehavior.Fill,
        ),
      });
    }
    return acc;
  }, []);
}

/**
 * Transform movedWidgets to FlexLayer format,
 * and determine if the new widgets have a fill child.
 * @param movedWidgets
 * @param allWidgets
 * @param alignment
 * @returns hasFillChild: boolean, layerChildren: string[]
 */
function createFlexLayer(
  movedWidgets: string[],
  allWidgets: CanvasWidgetsReduxState,
  alignment: FlexLayerAlignment,
): FlexLayer {
  let hasFillChild = false;
  const children = [];
  if (movedWidgets && movedWidgets.length) {
    for (const id of movedWidgets) {
      const widget = allWidgets[id];
      if (!widget) continue;
      if (widget.responsiveBehavior === ResponsiveBehavior.Fill)
        hasFillChild = true;
      children.push({ id, align: alignment });
    }
  }
  return { children, hasFillChild };
}

function* addWidgetAndReorderSaga(
  actionPayload: ReduxAction<{
    newWidget: WidgetAddChild;
    parentId: string;
    direction: LayoutDirection;
    dropPayload: HighlightInfo;
  }>,
) {
  const start = performance.now();
  const { direction, dropPayload, newWidget, parentId } = actionPayload.payload;
  const { alignment, index, isNewLayer, layerIndex } = dropPayload;
  try {
    const updatedWidgetsOnAddition: CanvasWidgetsReduxState = yield call(
      getUpdateDslAfterCreatingChild,
      {
        ...newWidget,
        widgetId: parentId,
      },
    );

    const updatedWidgetsOnMove: CanvasWidgetsReduxState = yield call(
      reorderAutolayoutChildren,
      {
        movedWidgets: [newWidget.newWidgetId],
        index,
        isNewLayer,
        parentId,
        allWidgets: updatedWidgetsOnAddition,
        alignment,
        direction,
        layerIndex,
      },
    );
    yield put(updateAndSaveLayout(updatedWidgetsOnMove));
    log.debug("reorder computations took", performance.now() - start, "ms");
  } catch (e) {
    // console.error(e);
  }
}

export default function* draggingCanvasSagas() {
  yield all([
    takeLatest(ReduxActionTypes.WIDGETS_MOVE, moveWidgetsSaga),
    takeLatest(
      ReduxActionTypes.WIDGETS_ADD_CHILD_AND_MOVE,
      addWidgetAndMoveWidgetsSaga,
    ),
    takeLatest(
      ReduxActionTypes.AUTOLAYOUT_REORDER_WIDGETS,
      autoLayoutReorderSaga,
    ),
    takeLatest(
      ReduxActionTypes.AUTOLAYOUT_ADD_NEW_WIDGETS,
      addWidgetAndReorderSaga,
    ),
  ]);
}
