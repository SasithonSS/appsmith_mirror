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
import { cloneDeep } from "lodash";
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
import {
  generateChildWidgets,
  GeneratedWidgetPayload,
  getUpdateDslAfterCreatingAutoLayoutChild,
  getUpdateDslAfterCreatingChild,
} from "sagas/WidgetAdditionSagas";
import { MainCanvasReduxState } from "reducers/uiReducers/mainCanvasReducer";
import { CANVAS_DEFAULT_MIN_HEIGHT_PX } from "constants/AppConstants";
import { generateReactKey } from "utils/generators";
import { Alignment, ButtonBoxShadowTypes, Spacing } from "components/constants";
import {
  getLayoutWrapperName,
  purgeEmptyWrappers,
} from "../WidgetOperationUtils";

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
    yield put(updateAndSaveLayout(updatedWidgetsOnMove));
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

function* autolayoutReorderSaga(
  actionPayload: ReduxAction<{
    movedWidgets: string[];
    index: number;
    parentId: string;
  }>,
) {
  const start = performance.now();

  const { index, movedWidgets, parentId } = actionPayload.payload;
  // console.log(`#### moved widgets: ${JSON.stringify(movedWidgets)}`);
  // console.log(`#### parentId: ${parentId}`);
  try {
    const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
    if (!parentId || !movedWidgets || !movedWidgets.length) return;
    const updatedWidgets: CanvasWidgetsReduxState = yield call(
      reorderAutolayoutChildren,
      {
        movedWidgets,
        index,
        parentId,
        allWidgets,
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
  parentId: string;
  allWidgets: CanvasWidgetsReduxState;
}) {
  const { allWidgets, index, movedWidgets, parentId } = params;
  const widgets = Object.assign({}, allWidgets);
  if (!movedWidgets) return widgets;
  const selectedWidgets = [...movedWidgets];
  // Check if parent has changed
  const orphans = selectedWidgets.filter(
    (item) => widgets[item].parentId !== parentId,
  );
  if (orphans && orphans.length) {
    //parent has changed
    // console.log(`#### orphans ${JSON.stringify(orphans)}`);
    // update parent for children
    orphans.forEach((item) => {
      const prevParentId = widgets[item].parentId;
      if (prevParentId !== undefined) {
        // console.log(`#### previous parent: ${prevParentId}`);
        const prevParent = Object.assign({}, widgets[prevParentId]);
        if (prevParent.children && Array.isArray(prevParent.children)) {
          const updatedPrevParent = {
            ...prevParent,
            children: prevParent.children.filter((each) => each !== item),
          };
          widgets[prevParentId] = updatedPrevParent;
        }
      }
      widgets[item] = {
        ...widgets[item],
        parentId: parentId,
      };
    });
  }
  // Remove all empty wrappers
  const trimmedWidgets = purgeEmptyWrappers(widgets);
  // console.log(`#### trimmed widgets: ${JSON.stringify(trimmedWidgets)}`);
  // Update moved widgets. Add wrappers to those missing one.
  const { newMovedWidgets, updatedWidgets } = yield call(
    updateMovedWidgets,
    movedWidgets,
    trimmedWidgets,
    parentId,
  );

  const items = [...(updatedWidgets[parentId].children || [])];
  // remove moved widegts from children
  const newItems = items.filter((item) => newMovedWidgets.indexOf(item) === -1);
  // calculate valid position for drop
  const pos = index > newItems.length ? newItems.length : index;
  updatedWidgets[parentId] = {
    ...trimmedWidgets[parentId],
    children: [
      ...newItems.slice(0, pos),
      ...newMovedWidgets,
      ...newItems.slice(pos),
    ],
  };
  return updatedWidgets;
}

function* updateMovedWidgets(
  movedWidgets: string[],
  allWidgets: CanvasWidgetsReduxState,
  parentId: string,
) {
  const stateParent = allWidgets[parentId];
  if (!movedWidgets || !allWidgets || stateParent.isWrapper)
    return { newMovedWidgets: movedWidgets, updatedWidgets: allWidgets };
  const newMovedWidgets: string[] = [];
  for (const each of movedWidgets) {
    const widget = allWidgets[each];
    if (!widget) continue;
    if (widget.isWrapper) {
      newMovedWidgets.push(each);
      continue;
    }

    // wrap the widget in a wrapper widget
    const wrapperPayload = {
      newWidgetId: generateReactKey(),
      type: "LAYOUT_WRAPPER_WIDGET",
      widgetName: getLayoutWrapperName(allWidgets),
      props: {
        containerStyle: "none",
        canExtend: false,
        detachFromLayout: true,
        children: [],
        alignment: Alignment.Left,
        spacing: Spacing.None,
        isWrapper: true,
        backgroundColor: "transparent",
        boxShadow: ButtonBoxShadowTypes.NONE,
        borderStyle: "none",
      },
      rows: widget.rows ? widget.rows + 1 : widget.bottomRow - widget.top + 1,
      columns: widget.columns
        ? widget.columns + 1
        : widget.rightColumn - widget.leftColumn + 1,
      widgetId: parentId,
      leftColumn: widget.leftColumn,
      topRow: widget.topRow,
      parentRowSpace: stateParent.parentRowSpace,
      parentColumnSpace: stateParent.parentColumnSpace,
      tabId: "",
    };
    const containerPayload: GeneratedWidgetPayload = yield generateChildWidgets(
      stateParent,
      wrapperPayload,
      allWidgets,
    );
    // Add widget to the wrapper
    let wrapper = containerPayload.widgets[containerPayload.widgetId];
    wrapper = {
      ...wrapper,
      children: [...(wrapper.children || []), each],
    };
    // Update parent of the widget
    allWidgets[each] = { ...widget, parentId: wrapper.widgetId };
    allWidgets[wrapper.widgetId] = wrapper;
    newMovedWidgets.push(wrapper.widgetId);
  }
  return { newMovedWidgets, updatedWidgets: allWidgets };
}

function* addWidgetAndReorderSaga(
  actionPayload: ReduxAction<{
    newWidget: WidgetAddChild;
    index: number;
    parentId: string;
  }>,
) {
  const start = performance.now();
  const { index, newWidget, parentId } = actionPayload.payload;
  try {
    const updatedWidgetsOnAddition: {
      widgets: CanvasWidgetsReduxState;
      containerId?: string;
    } = yield call(addAutoLayoutChild, newWidget, parentId);

    const updatedWidgetsOnMove: CanvasWidgetsReduxState = yield call(
      reorderAutolayoutChildren,
      {
        movedWidgets: [
          updatedWidgetsOnAddition.containerId || newWidget.newWidgetId,
        ],
        index,
        parentId,
        allWidgets: updatedWidgetsOnAddition.widgets,
      },
    );
    yield put(updateAndSaveLayout(updatedWidgetsOnMove));
    log.debug("reorder computations took", performance.now() - start, "ms");
  } catch (e) {
    // console.error(e);
  }
}

function* addAutoLayoutChild(newWidget: WidgetAddChild, parentId: string) {
  const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
  const stateParent: FlattenedWidgetProps = allWidgets[parentId];

  if (stateParent?.isWrapper) {
    const updatedWidgetsOnAddition: CanvasWidgetsReduxState = yield call(
      getUpdateDslAfterCreatingChild,
      {
        ...newWidget,
        widgetId: parentId,
      },
    );
    return { widgets: updatedWidgetsOnAddition };
  } else {
    const updatedWidgetsOnAddition: {
      widgets: CanvasWidgetsReduxState;
      containerId?: string;
    } = yield call(getUpdateDslAfterCreatingAutoLayoutChild, {
      ...newWidget,
      widgetId: parentId,
    });

    return updatedWidgetsOnAddition;
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
      autolayoutReorderSaga,
    ),
    takeLatest(
      ReduxActionTypes.AUTOLAYOUT_ADD_NEW_WIDGETS,
      addWidgetAndReorderSaga,
    ),
  ]);
}
