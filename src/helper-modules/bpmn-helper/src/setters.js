const {
  moddle,
  toBpmnObject,
  toBpmnXml,
  getElementById,
  getElementsByTagName,
  manipulateElementsByTagName,
  manipulateElementById,
  getChildren,
  getAllElements,
} = require('./util.js');

const {
  generateTargetNamespace,
  getUserTaskImplementationString,
} = require('./PROCEED-CONSTANTS.js');

const ConstraintParser = require('@proceed/constraint-parser-xml-json');

const constraintParser = new ConstraintParser();

/**
 * @module @proceed/bpmn-helper
 */

/**
 *  Sets id in definitions element to given id, if an id already exists and differs from the new one the old id will be saved in the originalId field
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} id - the id we want to set the definitions element to
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setDefinitionsId(bpmn, id) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.id = id;
  });
}

/**
 *  Sets name in definitions element to given name
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} name - the id we want to set the definitions element to
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setDefinitionsName(bpmn, name) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.name = `${name}`;
  });
}

/**
 * Will set a version in the definitions element
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {object} versionInformation - the version information to set in the definitions object
 * @param {(string)} [versionInformation.versionId] - the versionId (a uuid assigned to a version)
 * @param {string} [versionInformation.versionName] - a human readable name for the version
 * @param {string} [versionInformation.versionDescription] - a longer description of the version
 * @param {(string)} [versionInformation.versionBasedOn] - a reference to the version this one is based on
 * @param {(string)} [versionInformation.versionCreatedOn] - a timestamp (UTC) when the version was created
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setDefinitionsVersionInformation(
  bpmn,
  { versionId, versionName, versionDescription, versionBasedOn, versionCreatedOn },
) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.processVersionId = versionId;
    definitions.processVersionName = versionName;
    definitions.processVersionDescription = versionDescription;
    definitions.processVersionBasedOn = versionBasedOn;
    definitions.processVersionCreatedOn = versionCreatedOn;

    // make sure that the targetnamespace is unique for the new version
    definitions.targetNamespace = generateTargetNamespace(
      `${definitions.id}${versionCreatedOn ? `#${versionCreatedOn}` : ''}`,
    );
  });
}

/**
 *  Sets process Id in definitions element
 *
 * @param {string} bpmn the xml we want to update
 * @param {string} id the id we want to set for the process inside the bpmn
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setProcessId(bpmn, id) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Process', (process) => {
    process.id = `${id}`;
  });
}

/**
 *  Sets templateId in definitions element
 *
 * @param {string} bpmn the xml we want to update
 * @param {string} id the id we want to set for the template inside the bpmn
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setTemplateId(bpmn, id) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.templateId = `${id}`;
  });
}

/**
 * Sets targetNamespace in definitions element to https://docs.proceed-labs.org/${id}, keeps existing namespace as originalTargetNamespace
 *
 * @param {(string|object)} bpmn the process definition as XML string or BPMN-Moddle Object
 * @param {string} id the id to be used for the targetNamespace
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setTargetNamespace(bpmn, id) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    if (id) {
      const targetNamespace = generateTargetNamespace(id);

      definitions.targetNamespace = targetNamespace;
    } else {
      definitions.targetNamespace = undefined;
    }
  });
}

/**
 * Sets exporter, exporterVersion, expressionLanguage, typeLanguage and needed namespaces on defintions element
 * stores the previous values of exporter and exporterVersion if there are any
 *
 * @param {(string|object)} bpmn the process definition as XML string or BPMN-Moddle Object
 * @param {string} exporterName - the exporter name
 * @param {string} exporterVersion - the exporter version
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setStandardDefinitions(bpmn, exporterName, exporterVersion) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.exporter = exporterName;
    definitions.exporterVersion = exporterVersion;
    definitions.expressionLanguage = 'https://ecma-international.org/ecma-262/8.0/';
    definitions.typeLanguage =
      'https://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf';
    if (typeof definitions.$attrs != 'object') definitions.$attrs = {};
    delete definitions.$attrs['xmlns:bpmn'];
    definitions.$attrs['xmlns'] = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
    definitions.$attrs['xmlns:proceed'] = 'https://docs.proceed-labs.org/BPMN';

    const proceedXSIs = [
      'https://docs.proceed-labs.org/BPMN https://docs.proceed-labs.org/xsd/XSD-PROCEED.xsd',
      'http://www.omg.org/spec/BPMN/20100524/MODEL https://www.omg.org/spec/BPMN/20100501/BPMN20.xsd',
    ];

    if (typeof definitions.$attrs['xmlns:xsd'] !== 'string') {
      definitions.$attrs['xmlns:xsd'] = 'http://www.w3.org/2001/XMLSchema';
    }

    if (typeof definitions.$attrs['xsi:schemaLocation'] !== 'string') {
      definitions.$attrs['xsi:schemaLocation'] = '';
    }

    if (typeof definitions.creatorSpaceId !== 'string') {
      definitions.creatorSpaceId = '';
    }

    if (typeof definitions.creatorSpaceName !== 'string') {
      definitions.creatorSpaceName = '';
    }

    for (const xsi of proceedXSIs) {
      if (!definitions.$attrs['xsi:schemaLocation'].includes(xsi)) {
        definitions.$attrs['xsi:schemaLocation'] += ' ' + xsi;
      }
    }

    definitions.$attrs['xsi:schemaLocation'] = definitions.$attrs['xsi:schemaLocation'].trim();
  });
}

/**
 * Updates the creator BPMN XML attributes of the given BPMN process.
 *
 * @param {(string | object)} bpmn - The BPMN process definition as an XML string or a BPMN-Moddle object.
 * @param {object} attributes - The attributes to update in the BPMN process.
 * @param {string} [attributes.id] - The id of the BPMN process.
 * @param {string} [attributes.name] - The name of the BPMN process.
 * @param {string} [attributes.creatorId] - The unique identifier of the creator.
 * @param {string} [attributes.creatorName] - The name of the creator.
 * @param {string} [attributes.creatorUsername] - The username of the creator.
 * @param {string} [attributes.creatorSpaceId] - The unique identifier of the creator's space.
 * @param {string} [attributes.creatorSpaceName] - The name of the creator's space.
 * @param {string} [attributes.userDefinedId] - The user-defined ID of the BPMN process.
 * @param {string} [attributes.creationDate] - The creation date of the BPMN process in string format.
 * @returns {Promise<string | object>} A promise that resolves to the modified BPMN process,
 * either as a BPMN-Moddle object or an XML string, depending on the input format.
 */
async function updateBpmnCreatorAttributes(
  bpmn,
  {
    id,
    name,
    creatorId,
    creatorName,
    creatorUsername,
    creatorSpaceName,
    creatorSpaceId,
    userDefinedId,
    creationDate,
  },
) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    // userdefined id can be empty
    definitions.userDefinedId = userDefinedId;
    // creator name and username can be empty for guest user
    definitions.creatorName = creatorName;
    definitions.creatorUsername = creatorUsername;
    // personal spaces can be no name
    definitions.creatorSpaceName = creatorSpaceName;

    creatorSpaceId && (definitions.creatorSpaceId = creatorSpaceId);
    creatorId && (definitions.creatorId = creatorId);
    creationDate && (definitions.creationDate = creationDate);
    name && (definitions.name = name);
    id && (definitions.id = id);
  });
}

/**
 * Updates the original attributes of a copied/imported BPMN process.
 *
 * @param {(string | object)} bpmn - The BPMN process definition as an XML string or a BPMN-Moddle object.
 * @param {object} attributes - The original attributes to update in the BPMN process.
 * @param {string} [attributes.originalId] - The original of a copied/imported BPMN process.
 * @param {string} [attributes.originalName] - The original name of a copied/imported BPMN process.
 * @param {string} [attributes.originalUserDefinedId] - The original user-defined ID of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreationDate] - The original creation date of a copied/imported BPMN process.
 * @param {string} [attributes.originalProcessVersionId] - The original process version ID of a copied/imported BPMN process.
 * @param {string} [attributes.originalProcessVersionName] - The original process version name of a copied/imported BPMN process.
 * @param {string} [attributes.originalExporter] - The original exporter of a copied/imported BPMN process.
 * @param {string} [attributes.originalExporterVersion] - The original exporter version of a copied/imported BPMN process.
 * @param {string} [attributes.originalTargetNamespace] - The original target namespace of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreatorSpaceId] - The original creator space ID of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreatorSpaceName] - The original creator space name of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreatorId] - The original creator ID of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreatorName] - The original creator name of a copied/imported BPMN process.
 * @param {string} [attributes.originalCreatorUsername] - The original creator username of a copied/imported BPMN process.
 * @returns {Promise<string | object>} A promise that resolves to the modified BPMN process,
 * either as a BPMN-Moddle object or an XML string, depending on the input format.
 */
async function updateBpmnOriginalAttributes(
  bpmn,
  {
    originalId,
    originalName,
    originalUserDefinedId,
    originalCreationDate,
    originalProcessVersionId,
    originalProcessVersionName,
    originalExporter,
    originalExporterVersion,
    originalTargetNamespace,
    originalCreatorSpaceId,
    originalCreatorSpaceName,
    originalCreatorId,
    originalCreatorName,
    originalCreatorUsername,
  },
) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Definitions', (definitions) => {
    definitions.originalId ??= originalId;
    definitions.originalName ??= originalName;
    definitions.originalUserDefinedId ??= originalUserDefinedId;
    definitions.originalCreationDate ??= originalCreationDate;
    definitions.originalProcessVersionId ??= originalProcessVersionId;

    definitions.originalProcessVersionName ??= originalProcessVersionName;
    definitions.originalExporter ??= originalExporter;
    definitions.originalExporterVersion ??= originalExporterVersion;
    definitions.originalCreatorId ??= originalCreatorId;
    definitions.originalCreatorName ??= originalCreatorName;
    definitions.originalCreatorUsername ??= originalCreatorUsername;
    definitions.originalCreatorSpaceId ??= originalCreatorSpaceId;
    definitions.originalCreatorSpaceName ??= originalCreatorSpaceName;
    definitions.originalTargetNamespace ??= originalTargetNamespace;
  });
}

/**
 * Sets deployment method of a process
 *
 * @param {(string|object)} bpmn the process definition as XML string or BPMN-Moddle Object
 * @param {string} method the method we want to set (dynamic/static)
 * @returns {Promise<string|object>} the modified BPMN process as bpmn-moddle object or XML string based on input
 */
async function setDeploymentMethod(bpmn, method) {
  return await manipulateElementsByTagName(bpmn, 'bpmn:Process', (process) => {
    process.deploymentMethod = method;
  });
}

/**
 * Sets the 'uiForNontypedStartEventsFileName' attribute of a process with new values.
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} processId - the processId to look for
 * @param {string} newFileName - the new value of 'uiForNontypedStartEventsFileName' attribute
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function setStartFormFileName(bpmn, processId, newFileName) {
  return await manipulateElementById(bpmn, processId, (p) => {
    p.uiForNontypedStartEventsFileName = newFileName;
  });
}

/**
 * Sets the 'fileName' and 'implementation' attributes of a UserTask with new values.
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} userTaskId - the userTaskId to look for
 * @param {string} newFileName - the new value of 'fileName' attribute
 * @param {string} [newImplementation] - the new value of 'implementation' attribute; will default to html implementation
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function setUserTaskData(
  bpmn,
  userTaskId,
  newFileName,
  newImplementation = getUserTaskImplementationString(),
) {
  return await manipulateElementById(bpmn, userTaskId, (userTask) => {
    userTask.fileName = newFileName;
    userTask.implementation = newImplementation;
  });
}

/**
 * Sets the 'fileName' attributes of a ScriptTask with new values.
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} scriptTaskId - the scriptTaskId to look for
 * @param {string} newFileName - the new value of 'fileName' attribute
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function setScriptTaskData(bpmn, scriptTaskId, newFileName) {
  return await manipulateElementById(bpmn, scriptTaskId, (scriptTask) => {
    scriptTask.fileName = newFileName;
  });
}

/**
 * Function that sets the machineInfo of all elements in the given xml with the given machineIds
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {{[elementId: string]: {machineAddress?: string, machineId?: string}}} machineInfo the machineAddresses and machineIps of all the elements we want to set
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function setMachineInfo(bpmn, machineInfo) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;

  const elementIds = Object.keys(machineInfo);
  elementIds.forEach(async (elementId) => {
    const element = getElementById(bpmnObj, elementId);
    element.machineAddress = machineInfo[elementId].machineAddress;
    element.machineId = machineInfo[elementId].machineId;
  });

  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Adds the given constraint to the given bpmn element
 *
 * @param {object} element the bpmn BPMN-Moddle element
 * @param {object} cons object containing the hardConstraints and softConstraints
 */
async function addConstraintsToElement(element, cons) {
  if (element) {
    let { extensionElements } = element;

    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      extensionElements.values = [];
      element.extensionElements = extensionElements;
    }

    if (!extensionElements.values) {
      extensionElements.values = [];
    }

    extensionElements.values = extensionElements.values.filter(
      (child) => child.$type !== 'proceed:ProcessConstraints',
    );

    if (cons) {
      const { hardConstraints, softConstraints } = cons;
      const constraints = { processConstraints: { hardConstraints, softConstraints } };
      let constraintXML = constraintParser.fromJsToXml(constraints);
      constraintXML = `<?xml version="1.0" encoding="UTF-8"?>
        <bpmn2:extensionElements xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:proceed="https://docs.proceed-labs.org/BPMN">
          ${constraintXML}
        </bpmn2:extensionElements>`;
      const constraintObj = await toBpmnObject(constraintXML, 'bpmn:ExtensionElements');
      extensionElements.values.push(constraintObj.values[0]);
    }
  }
}

/**
 * Update the performer info of an element
 *
 * @param {object} element the element to update
 * @param {Array} performers the performer data to emplace in the element
 */
async function updatePerformersOnElement(element, performers) {
  if (element) {
    // create the moddle representation for the performers
    const formalExpression = moddle.create('bpmn:Expression', {
      body: JSON.stringify(performers),
    });
    const resourceAssignmentExpression = moddle.create('bpmn:ResourceAssignmentExpression', {
      expression: formalExpression,
    });

    const potentialOwner = moddle.create('bpmn:PotentialOwner', {
      resourceAssignmentExpression,
    });

    // add/update the performers of the element
    if (!element.resources) {
      element.resources = [];
    }

    // remove the current performers and add the new ones (if there are new performers)
    element.resources = element.resources.filter(
      (resource) => resource.$type !== 'bpmn:PotentialOwner',
    );

    if (performers.length) {
      element.resources = [...element.resources, potentialOwner];
    }
  }
}

/**
 * Update the performer info of an element in a bpmn file/object
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} elementId
 * @param {Array} performers the performer data to emplace in the element
 */
async function updatePerformersOnElementById(bpmn, elementId, performers) {
  return await manipulateElementById(bpmn, elementId, (element) => {
    updatePerformersOnElement(element, performers);
  });
}

/**
 * Adds the given constraints to the bpmn element with the given id
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} elementId
 * @param {object} constraints object containing the hardConstraints and softConstraints
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function addConstraintsToElementById(bpmn, elementId, constraints) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;
  await addConstraintsToElement(getElementById(bpmnObj, elementId), constraints);
  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Add meta information of the called bpmn process to the bpmn file where it's getting called from. This includes a custom namespace in the definitions part,
 * an import element as first child of definitions and the calledElement attribute of the call activity bpmn element
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} callActivityId The ID of the call activity bpmn element
 * @param {string} calledBpmn The bpmn file of the called process
 * @param {string} calledProcessLocation The DefinitionId of the calledBpmn. Combination of process name and process id
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function addCallActivityReference(bpmn, callActivityId, calledBpmn, calledProcessLocation) {
  // checks if there is already a reference for this call activity and remove it with all related informations (namespace definitions/imports)
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;
  const callActivity = getElementById(bpmnObj, callActivityId);
  if (callActivity.calledElement) {
    await removeCallActivityReference(bpmnObj, callActivityId);
  }

  // Retrieving all necessary informations from the called bpmn
  const calledBpmnObject = await toBpmnObject(calledBpmn);
  const [calledBpmnDefinitions] = getElementsByTagName(calledBpmnObject, 'bpmn:Definitions');
  const [calledProcess] = getElementsByTagName(calledBpmnObject, 'bpmn:Process');
  const targetNamespace = calledBpmnDefinitions.targetNamespace;
  const importVersion = calledBpmnDefinitions.version;

  // Construct namespace in format p+(last 3 chars from the imported namespace id part and last 3 from the version part), for example 'p3c2324'
  const [idPart, versionPart] = targetNamespace.split('#');
  const nameSpacePrefix =
    'p' + idPart.substring(idPart.length - 3) + versionPart.substring(versionPart.length - 3);

  // Adding the prefixed namespace attribute and the import child-element to the definitions
  await manipulateElementsByTagName(bpmnObj, 'bpmn:Definitions', (definitions) => {
    definitions.$attrs[`xmlns:${nameSpacePrefix}`] = targetNamespace;

    if (!Array.isArray(definitions.imports)) {
      definitions.imports = [];
    }

    // Checks if there is no import element with the same namespace
    const processImport = definitions.imports.find(
      (element) => element.namespace === targetNamespace,
    );

    if (!processImport) {
      let importElement = moddle.create('bpmn:Import');
      importElement.namespace = targetNamespace;
      importElement.location = calledProcessLocation;
      importElement.version = importVersion;
      importElement.importType = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

      definitions.imports.push(importElement);
    } else {
      // update process location which might have changed
      processImport.location = calledProcessLocation;
    }
  });

  // Adding the desired information to the bpmn call activity element
  await manipulateElementById(bpmnObj, callActivityId, (callActivity) => {
    callActivity.calledElement = `${nameSpacePrefix}:${calledProcess.id}`;
    callActivity.name = calledBpmnDefinitions.name;
  });

  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Remove the reference to the called process added in {@link addCallActivityReference} but remains the actual bpmn element
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} callActivityId The ID of the bpmn element for which the meta information should be removed
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function removeCallActivityReference(bpmn, callActivityId) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;
  const callActivityElement = getElementById(bpmnObj, callActivityId);

  if (typeof callActivityElement.calledElement !== 'string') {
    return bpmn;
  }

  // deconstruct 'p33c24:_e069937f-27b6-464b-b397-b88a2599f1b9' to 'p33c24'
  const [prefix, processId] = callActivityElement.calledElement.split(':');

  // remove the reference values from the call activity
  await manipulateElementById(bpmnObj, callActivityId, (callActivity) => {
    delete callActivity.calledElement;
    callActivity.name = '';
  });

  const callActivities = getElementsByTagName(bpmnObj, 'bpmn:CallActivity').filter(
    (callActivity) => typeof callActivity.calledElement === 'string',
  );

  // remove import and namespace in definitions if there is no other call activity referencing the same process
  if (callActivities.every((callActivity) => !callActivity.calledElement.startsWith(prefix))) {
    await manipulateElementsByTagName(bpmnObj, 'bpmn:Definitions', (definitions) => {
      const importedNamespace = definitions.$attrs[`xmlns:${prefix}`];
      delete definitions.$attrs[`xmlns:${prefix}`];

      if (Array.isArray(definitions.imports)) {
        definitions.imports = definitions.imports.filter(
          (element) => element.namespace !== importedNamespace,
        );
      }
    });
  }
  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Look up the given bpmn document for unused imports/custom namespaces which don't get referenced by a call activity inside this bpmn document.
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function removeUnusedCallActivityReferences(bpmn) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;
  const callActivityElements = getElementsByTagName(bpmnObj, 'bpmn:CallActivity').filter(
    (element) => element.calledElement,
  );

  await manipulateElementsByTagName(bpmnObj, 'bpmn:Definitions', (definitions) => {
    // there can only be imports and namespaces for non-existent CallActivities if there are actual imports existent and if there are more imports than call activities
    if (Array.isArray(definitions.imports)) {
      // will be used for comparison later
      const importedNamespaces = definitions.imports.map(
        (importElement) => importElement.namespace,
      );

      // iterate over all custom namespaces
      for (const key in definitions.$attrs) {
        // filter namespaces that occur in the imported namespaces
        if (importedNamespaces.includes(definitions.$attrs[key])) {
          // deconstruct 'xmlns:p33c24' to 'p33c24'
          const [_, prefix] = key.split(':');

          // checks if there is no actual call activity with this prefix in the calledElement attribute
          if (
            !callActivityElements.some((callActivityElement) =>
              callActivityElement.calledElement.startsWith(prefix),
            )
          ) {
            // remove the unused import element
            definitions.imports = definitions.imports.filter(
              (element) => element.namespace !== definitions.$attrs[key],
            );
            // remove the unused namespace in definitions
            delete definitions.$attrs[key];
          }
        }
      }
    }
  });

  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Adds a documentation element to the first process in the process definition
 *
 * @param {(string|object)} bpmn - the process definition as XML string or BPMN-Moddle Object
 * @param {string} [description] the content for the documentation element
 * @returns {Promise<string|object>} the BPMN process as XML string or BPMN-Moddle Object based on input
 */
async function addDocumentation(bpmn, description) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;
  const [process] = getElementsByTagName(bpmnObj, 'bpmn:Process');

  if (!process) {
    return bpmn;
  }
  addDocumentationToProcessObject(process, description);

  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

/**
 * Adds documentation to a given process object
 *
 * @param {object} processObj
 * @param {string} [description]
 */
function addDocumentationToProcessObject(processObj, description) {
  const docs = processObj.get('documentation');
  const documentation = moddle.create('bpmn:Documentation', { text: description || '' });
  if (docs.length > 0) {
    docs[0] = documentation;
  } else {
    docs.push(documentation);
  }
}

/**
 * Remove color from all elements of given process
 *
 * @param {string|object} bpmn
 * @returns {Promise<string|object>}
 */
async function removeColorFromAllElements(bpmn) {
  const bpmnObj = typeof bpmn === 'string' ? await toBpmnObject(bpmn) : bpmn;

  bpmnObj.diagrams.forEach((diagram) => {
    diagram.plane.planeElement.forEach((planeElement) => {
      planeElement.fill = null;
      planeElement.stroke = null;
    });
  });

  return typeof bpmn === 'string' ? await toBpmnXml(bpmnObj) : bpmnObj;
}

module.exports = {
  setDefinitionsId,
  setDefinitionsName,
  setDefinitionsVersionInformation,
  setProcessId,
  setStartFormFileName,
  setTemplateId,
  setTargetNamespace,
  setStandardDefinitions,
  setDeploymentMethod,
  setMachineInfo,
  setUserTaskData,
  setScriptTaskData,
  addConstraintsToElementById,
  addCallActivityReference,
  removeCallActivityReference,
  removeUnusedCallActivityReferences,
  removeColorFromAllElements,
  addDocumentation,
  addDocumentationToProcessObject,
  updatePerformersOnElement,
  updatePerformersOnElementById,
  updateBpmnCreatorAttributes,
  updateBpmnOriginalAttributes,
};
