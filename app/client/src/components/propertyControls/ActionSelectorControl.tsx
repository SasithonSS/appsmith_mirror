import React from "react";
import BaseControl, { ControlData, ControlProps } from "./BaseControl";
// import DynamicActionCreator from "components/editorComponents/DynamicActionCreator";
import ActionCreator from "components/editorComponents/ActionCreator";
import {
  DSEventDetail,
  DSEventTypes,
  DS_EVENT,
  emitInteractionAnalyticsEvent,
} from "utils/AppsmithUtils";
import { getCodeFromMoustache } from "components/editorComponents/ActionCreator/utils";
import { AppsmithFunctionsWithFields } from "components/editorComponents/ActionCreator/constants";
import { getActionBlockFunctionNames } from "@shared/ast";
import { getActions, getJSCollections } from "selectors/entitiesSelector";
import store from "store";

class ActionSelectorControl extends BaseControl<ControlProps> {
  componentRef = React.createRef<HTMLDivElement>();

  componentDidMount() {
    this.componentRef.current?.addEventListener(
      DS_EVENT,
      this.handleAdsEvent as (arg0: Event) => void,
    );
  }

  componentWillUnmount() {
    this.componentRef.current?.removeEventListener(
      DS_EVENT,
      this.handleAdsEvent as (arg0: Event) => void,
    );
  }

  handleAdsEvent = (e: CustomEvent<DSEventDetail>) => {
    if (
      e.detail.component === "TreeDropdown" &&
      e.detail.event === DSEventTypes.KEYPRESS
    ) {
      emitInteractionAnalyticsEvent(this.componentRef.current, {
        key: e.detail.meta.key,
      });
      e.stopPropagation();
    }
  };

  handleValueUpdate = (newValue: string, isUpdatedViaKeyboard = false) => {
    const { propertyName, propertyValue } = this.props;
    if (!propertyValue && !newValue) return;
    this.updateProperty(propertyName, newValue, isUpdatedViaKeyboard);
  };

  render() {
    const { label, propertyValue } = this.props;

    return (
      <ActionCreator
        action={label}
        additionalAutoComplete={this.props.additionalAutoComplete}
        onValueChange={this.handleValueUpdate}
        ref={this.componentRef}
        value={propertyValue}
      />
    );
  }

  static getControlType() {
    return "ACTION_SELECTOR";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static canDisplayValueInUI(config: ControlData, value: any): boolean {
    const state = store.getState();
    const actions = getActions(state);
    const jsActions = getJSCollections(state);
    const codeFromProperty = getCodeFromMoustache(value);

    const actionsArray: string[] = [];
    const jsActionsArray: string[] = [];

    actions.forEach((action) => {
      actionsArray.push(action.config.name + ".run");
      actionsArray.push(action.config.name + ".clear");
    });

    jsActions.forEach((jsAction) =>
      jsAction.config.actions.forEach((action) => {
        jsActionsArray.push(jsAction.config.name + "." + action.name);
      }),
    );

    const {
      actionBlockFunctionNames,
      canTranslate,
    } = getActionBlockFunctionNames(codeFromProperty, self.evaluationVersion);

    if (codeFromProperty.trim() && !canTranslate) {
      return false;
    }
    for (const fn of actionBlockFunctionNames) {
      if (
        ![
          ...AppsmithFunctionsWithFields,
          ...actionsArray,
          ...jsActionsArray,
        ].includes(fn)
      ) {
        return false;
      }
    }
    return true;
  }
}

export default ActionSelectorControl;
