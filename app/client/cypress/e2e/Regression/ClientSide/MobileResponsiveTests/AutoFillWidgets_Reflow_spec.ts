import {
  autoLayout,
  agHelper,
  deployMode,
  homePage,
} from "../../../../support/Objects/ObjectsCore";
import HomePage from "../../../../locators/HomePage";

describe("Auto Layout Reflow in small screen devices(Mobiles/Tabs) and public apps", () => {
  before(() => {
    autoLayout.ConvertToAutoLayoutAndVerify(false);
    agHelper.Sleep(2000);
    cy.fixture("autoLayoutReflow").then((val) => {
      agHelper.AddDsl(val);
    });
  });

  it("1. Containers Should Reflow in smaller viewports", () => {
    agHelper.GetNClick(HomePage.shareApp);
    //@ts-expect-error no type access
    cy.enablePublicAccess(true);
    deployMode.DeployApp();
    autoLayout.getAutoLayoutLayerClassName("0", 0);
    agHelper.AssertCSS(
      autoLayout.getAutoLayoutLayerClassName("0", 0),
      "flex-wrap",
      "nowrap",
    );
    cy.viewport("iphone-4");
    cy.wait(2000);
    agHelper.AssertCSS(
      autoLayout.getAutoLayoutLayerClassName("0", 0),
      "flex-wrap",
      "wrap",
    );
  });
  it.skip("2. Auto Layout Reflow should work in public apps as well", () => {
    let currentUrl = "";
    cy.url().then((url) => {
      currentUrl = url;
      cy.log(currentUrl);
    });
    homePage.Signout(false).then(() => {
      agHelper.VisitNAssert(currentUrl, "getPagesForViewApp");
      agHelper.AssertCSS(
        autoLayout.getAutoLayoutLayerClassName("0", 0),
        "flex-wrap",
        "nowrap",
      );
      cy.viewport("iphone-4");
      cy.wait(2000);
      agHelper.AssertCSS(
        autoLayout.getAutoLayoutLayerClassName("0", 0),
        "flex-wrap",
        "wrap",
      );
    });
  });
});
