import { ENTITY_TYPE } from "entities/DataTree/dataTreeFactory";

export const unEvalTree = {
  MainContainer: {
    widgetName: "MainContainer",
    backgroundColor: "none",
    rightColumn: 2220,
    snapColumns: 64,
    detachFromLayout: true,
    widgetId: "0",
    topRow: 0,
    bottomRow: 640,
    containerStyle: "none",
    snapRows: 113,
    parentRowSpace: 1,
    type: "CANVAS_WIDGET",
    canExtend: true,
    version: 52,
    minHeight: 620,
    parentColumnSpace: 1,
    leftColumn: 0,
    children: ["j9dpft2lpu", "l0yem4eh6l"],
    meta: {},
    ENTITY_TYPE: ENTITY_TYPE.WIDGET,
  },
  Button1: {
    widgetName: "Button1",
    buttonColor: "#03B365",
    displayName: "Button",
    iconSVG: "/static/media/icon.cca02633.svg",
    topRow: 15,
    bottomRow: 19,
    parentRowSpace: 10,
    type: "BUTTON_WIDGET",
    hideCard: false,
    animateLoading: true,
    parentColumnSpace: 26.421875,
    leftColumn: 20,
    text: "button1",
    isDisabled: false,
    key: "r6h8y6dc8i",
    rightColumn: 36,
    isDefaultClickDisabled: true,
    widgetId: "j9dpft2lpu",
    isVisible: true,
    recaptchaType: "V3",
    version: 1,
    parentId: "0",
    renderMode: "CANVAS",
    isLoading: false,
    buttonVariant: "PRIMARY",
    placement: "CENTER",
    meta: {},
    ENTITY_TYPE: ENTITY_TYPE.WIDGET,
  },
  Button2: {
    widgetName: "Button2",
    buttonColor: "#03B365",
    displayName: "Button",
    iconSVG: "/static/media/icon.cca02633.svg",
    topRow: 25,
    bottomRow: 29,
    parentRowSpace: 10,
    type: "BUTTON_WIDGET",
    hideCard: false,
    animateLoading: true,
    parentColumnSpace: 26.421875,
    leftColumn: 20,
    text: "{{Button1.text}}",
    isDisabled: false,
    key: "r6h8y6dc8i",
    rightColumn: 36,
    isDefaultClickDisabled: true,
    widgetId: "l0yem4eh6l",
    isVisible: true,
    recaptchaType: "V3",
    version: 1,
    parentId: "0",
    renderMode: "CANVAS",
    isLoading: false,
    buttonVariant: "PRIMARY",
    placement: "CENTER",
    meta: {},
    ENTITY_TYPE: ENTITY_TYPE.WIDGET,
  },
  appsmith: {
    user: {
      email: "rathod@appsmith.com",
      workspaceIds: [
        "6218a61972ccd9145ec78c57",
        "621913df0276eb01d22fec44",
        "60caf8edb1e47a1315f0c48f",
        "609114fe05c4d35a9f6cbbf2",
      ],
      username: "rathod@appsmith.com",
      name: "Rishabh",
      commentOnboardingState: "RESOLVED",
      role: "engineer",
      useCase: "personal project",
      enableTelemetry: false,
      emptyInstance: false,
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      isAnonymous: false,
      isEnabled: true,
      isSuperUser: false,
      isConfigurable: true,
    },
    URL: {
      fullPath:
        "https://dev.appsmith.com/applications/6200d1a2b5bfc0392b959cab/pages/6220c268c48234070f8ac65a/edit?a=b",
      host: "dev.appsmith.com",
      hostname: "dev.appsmith.com",
      queryParams: {
        a: "b",
      },
      protocol: "https:",
      pathname:
        "/applications/6200d1a2b5bfc0392b959cab/pages/6220c268c48234070f8ac65a/edit",
      port: "",
      hash: "",
    },
    store: {
      textColor: "#DF7E65",
    },
    geolocation: {
      canBeRequested: true,
    },
    mode: "EDIT",
    ENTITY_TYPE: ENTITY_TYPE.APPSMITH,
  },
};

export const unEvalTreeWidgetSelectWidget = {
  ...unEvalTree,
  Select2: {
    boxShadow: "none",
    widgetName: "Select2",
    isFilterable: true,
    displayName: "Select",
    iconSVG: "/static/media/icon.bd99caba5853ad71e4b3d8daffacb3a2.svg",
    labelText: "Label",
    searchTags: ["dropdown"],
    topRow: 7,
    bottomRow: 11,
    parentRowSpace: 10,
    labelWidth: 5,
    type: "SELECT_WIDGET",
    serverSideFiltering: false,
    hideCard: false,
    defaultOptionValue: "",
    animateLoading: true,
    parentColumnSpace: 15.0625,
    leftColumn: 24,
    labelPosition: "Left",
    options:
      '[\n  {\n    "label": "Blue",\n    "value": "BLUE"\n  },\n  {\n    "label": "Green",\n    "value": "GREEN"\n  },\n  {\n    "label": "Red",\n    "value": "RED"\n  }\n]',
    placeholderText: "Select option",
    isDisabled: false,
    key: "od4dcrgp5p",
    labelTextSize: "0.875rem",
    isRequired: false,
    isDeprecated: false,
    rightColumn: 44,
    widgetId: "kqre06w7ev",
    accentColor: "{{appsmith.theme.colors.primaryColor}}",
    isVisible: true,
    version: 1,
    parentId: "0",
    labelAlignment: "left",
    renderMode: "CANVAS",
    isLoading: false,
    borderRadius: "{{appsmith.theme.borderRadius.appBorderRadius}}",
    isValid:
      '{{(()=>{return Select2.isRequired      ? !_.isNil(Select2.selectedOptionValue) && Select2.selectedOptionValue !== ""      : true;})()}}',
    selectedOptionValue:
      '{{(()=>{const isServerSideFiltered = Select2.serverSideFiltering;    const options = Select2.options ?? [];    let value = Select2.value?.value ?? Select2.value;    const valueIndex = _.findIndex(options, (option) => option.value === value);    if (valueIndex === -1) {      if (!isServerSideFiltered) {        value = "";      }      if (        isServerSideFiltered &&        !_.isPlainObject(Select2.value) &&        !Select2.isDirty      ) {        value = "";      }    }    return value;})()}}',
    selectedOptionLabel:
      '{{(()=>{const isServerSideFiltered = Select2.serverSideFiltering;    const options = Select2.options ?? [];    let label = Select2.label?.label ?? Select2.label;    const labelIndex = _.findIndex(      options,      (option) =>        option.label === label && option.value === Select2.selectedOptionValue,    );    if (labelIndex === -1) {      if (        !_.isNil(Select2.selectedOptionValue) &&        Select2.selectedOptionValue !== ""      ) {        const selectedOption = _.find(          options,          (option) => option.value === Select2.selectedOptionValue,        );        if (selectedOption) {          label = selectedOption.label;        }      } else {        if (          !isServerSideFiltered ||          (isServerSideFiltered && Select2.selectedOptionValue === "")        ) {          label = "";        }      }    }    return label;})()}}',
    meta: {
      filterText: "",
    },
    ENTITY_TYPE: ENTITY_TYPE.WIDGET,
    filterText: "",
    isDirty: false,
  },
};
