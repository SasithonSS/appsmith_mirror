import {
  entityExplorer,
  locators,
  agHelper,
  propPane,
  pageSettings,
  draggableWidgets,
} from "../../../../support/Objects/ObjectsCore";

describe("Dynamic Height Width validation", function () {
  it("1. Validate change with auto height width for Form/Switch", function () {
    agHelper.AddDsl("dynamicHeightFormSwitchdsl");

    entityExplorer.SelectEntityByName("Form1", "Widgets");
    agHelper
      .GetWidgetCSSHeight(locators._widgetInDeployed(draggableWidgets.FORM))
      .then((formheight) => {
        propPane.SelectPropertiesDropDown("height", "Auto Height");
        entityExplorer.SelectEntityByName("SwitchGroup1", "Form1");
        propPane.SelectPropertiesDropDown("height", "Auto Height");
        agHelper
          .GetWidgetCSSHeight(
            locators._widgetInDeployed(draggableWidgets.SWITCHGROUP),
          )
          .then((CurrentSwitchHeight) => {
            agHelper
              .GetWidgetCSSHeight(
                locators._widgetInDeployed(draggableWidgets.FORM),
              )
              .then((CurrentFormHeight) => {
                agHelper.UpdateCodeInput(
                  locators._controlOption,
                  `[
                      {"label": "Blue","value": "BLUE"},
                      { "label": "Green","value": "GREEN"},
                      {"label": "Red","value": "RED"},
                      { "label": "Yellow","value": "YELLOW"},
                      {"label": "Purple","value": "PURPLE"},
                      {"label": "Pink","value": "PINK"},
                      {"label": "Black","value": "BLACK"},
                      {"label": "Grey","value": "GREY"},
                      {"label": "Orange","value": "ORANGE"},
                      {"label": "Cream","value": "CREAM"}
                    ]`,
                );
                agHelper.Sleep(3000);
                agHelper
                  .GetWidgetCSSHeight(
                    locators._widgetInDeployed(draggableWidgets.SWITCHGROUP),
                  )
                  .then((UpdatedSwitchHeight: number) => {
                    agHelper
                      .GetWidgetCSSHeight(
                        locators._widgetInDeployed(draggableWidgets.FORM),
                      )
                      .then((UpdatedFormHeight: number) => {
                        expect(CurrentFormHeight).to.not.equal(
                          UpdatedFormHeight,
                        );
                        expect(CurrentSwitchHeight).to.not.equal(
                          UpdatedSwitchHeight,
                        );
                      });
                  });
              });
          });
      });
    agHelper.GetNClick(
      `${locators._widgetInDeployed(draggableWidgets.SWITCHGROUP)} ${
        pageSettings.locators._setHomePageToggle
      }`,
    );
    agHelper.AssertElementLength(locators._modal, 1);
    //propPane.TogglePropertyState("Switch","On");
    entityExplorer.SelectEntityByName("Modal1");
    propPane.SelectPropertiesDropDown("height", "Auto Height");
    agHelper.GetNClick(locators._closeModal, 0, true);
  });
});
