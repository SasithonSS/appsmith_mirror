import { agHelper, dataSources } from "../../../../support/Objects/ObjectsCore";
import { addIndexedDBKey } from "../../../../support/commands";
import {
  FEATURE_WALKTHROUGH_INDEX_KEY,
  USER_SIGN_UP_INDEX_KEY,
  WALKTHROUGH_TEST_PAGE,
} from "../../../../support/Constants";

let datasourceName;
describe(`${WALKTHROUGH_TEST_PAGE} : Walkthrough test for binding UI on action page`, () => {
  before(() => {
    dataSources.CreateDataSource("Postgres");
    cy.get("@dsName").then(($dsName) => {
      datasourceName = $dsName;
    });
    addIndexedDBKey(FEATURE_WALKTHROUGH_INDEX_KEY, {
      ab_ds_binding_enabled: false,
      ab_ds_schema_enabled: true,
      binding_widget: true,
    });

    addIndexedDBKey(USER_SIGN_UP_INDEX_KEY, {
      [Cypress.env("USERNAME")]: Date.now(),
    });
  });

  it("Binding walkthrough should appear", () => {
    dataSources.CreateQueryAfterDSSaved("select * from users limit 10");
    dataSources.RunQuery();
    agHelper.WaitUntilEleAppear(agHelper._walkthroughOverlay);
  });
});
