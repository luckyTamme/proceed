import { test, expect } from './processes.fixtures';
import {
  openModal,
  closeModal,
  waitForHydration,
  removeCreatorDefinitionAttributes,
  setBpmnOriginalAttributes,
} from '../testUtils';
import { Page } from '@playwright/test';

test('create a new process and remove it again', async ({ processListPage }) => {
  const { page } = processListPage;

  const processDefinitionID = await processListPage.createProcess({
    processName: 'Process Name',
    description: 'Process Description',
  });

  await processListPage.goto();

  await expect(page.locator(`tr[data-row-key="${processDefinitionID}"]`)).toBeVisible();
  /* Select Process */
  await page.locator(`tr[data-row-key="${processDefinitionID}"]`).getByRole('checkbox').check();
  // await page.getByLabel('', { exact: true }).check();
  // await page.getByRole('button', { name: 'delete' }).click();

  const modal = await openModal(
    page,
    async () => await page.getByRole('button', { name: /delete/i }).click(),
    // page
    // .locator(`tr[data-row-key="${processDefinitionID}"]`)
    // .getByRole('button', { name: 'delete' })
    // .click(),
  );

  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());

  await expect(page.locator(`tr[data-row-key="${processDefinitionID}"]`)).not.toBeVisible();

  processListPage.getDefinitionIds().splice(0, 1);
});

test('import a process', async ({ processListPage }) => {
  const { page } = processListPage;

  const { definitionId } = await processListPage.importProcess('process1.bpmn');
  // open the new process in the modeler
  await page.locator(`tr[data-row-key="${definitionId}"]>td:nth-child(3)`).click();
  await page.waitForURL(/processes\/([a-zA-Z0-9-_]+)/);

  // check if the process in the modeler is the one that we tried to import
  await expect(page.locator('svg[data-element-id="Process_05s7742"]')).toBeVisible();
  await expect(page.locator('.djs-shape[data-element-id="StartEvent_1eclh91"]')).toBeVisible();
  await expect(page.locator('.djs-connection[data-element-id="Flow_034bmxw"]')).toBeVisible();
  await expect(page.locator('.djs-shape[data-element-id="Activity_1m5esxh"]')).toBeVisible();
  await expect(page.locator('.djs-connection[data-element-id="Flow_0evtfpc"]')).toBeVisible();
  await expect(page.locator('.djs-shape[data-element-id="Event_1oxwp3r"]')).toBeVisible();
});

test('export a single process', async ({ processListPage }) => {
  const { page } = processListPage;

  const { definitionId, bpmn: importBpmn } = await processListPage.importProcess(
    'process1.bpmn',
    undefined,
    setBpmnOriginalAttributes,
  );

  /*************************** BPMN Export ********************************/

  let modal = await openModal(page, async () => {
    await page.locator(`tr[data-row-key="${definitionId}"]`).getByRole('checkbox').check();
    return page.getByRole('button', { name: /download/i }).click();
  });
  await expect(page.getByTestId('Share Modal').getByRole('dialog')).toBeVisible();
  await modal.getByRole('button', { name: 'Download Diagram as BPMN' }).click();
  const { filename: bpmnFilename, content: exportBpmn } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'string',
  );
  expect(bpmnFilename).toMatch(/.bpmn$/);
  // we need to remove creator attributes as they are set dynamically on import for the current user
  const exportBpmnWithOutCreatorAttrs = removeCreatorDefinitionAttributes(exportBpmn);
  const importBpmnWithOutCreatorAttrs = removeCreatorDefinitionAttributes(importBpmn);
  // check if the exported data is the expected bpmn (the one that was initially imported)
  expect(exportBpmnWithOutCreatorAttrs).toBe(importBpmnWithOutCreatorAttrs);

  /*************************** SVG Export ********************************/

  // test the svg export with only a single file
  modal = await openModal(page, async () => {
    await page.locator(`tr[data-row-key="${definitionId}"]`).getByRole('checkbox').check();
    return page.getByRole('button', { name: /download/i }).click();
  });
  await modal.getByRole('button', { name: 'Download Diagram as SVG' }).click();
  const { filename: svgFilename, content: exportSvg } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'string',
  );

  // check that the exported svg matches the imported bpmn
  expect(svgFilename).toMatch(/.svg$/);
  expect(exportSvg).toMatch(/<svg/);
  expect(exportSvg).toMatch(/data-element-id="StartEvent_1eclh91"/);
  expect(exportSvg).toMatch(/data-element-id="Flow_034bmxw"/);
  expect(exportSvg).toMatch(/data-element-id="Activity_1m5esxh"/);
  expect(exportSvg).toMatch(/data-element-id="Flow_0evtfpc"/);
  expect(exportSvg).toMatch(/data-element-id="Event_1oxwp3r"/);

  /* Deselect Process */
  await page.locator(`tr[data-row-key="${definitionId}"]`).getByRole('checkbox').uncheck();

  // import a process containing collapsed subprocesses
  const { definitionId: subprocessDefinitionId, definitionName: subprocessDefinitionName } =
    await processListPage.importProcess('subprocess.bpmn');
  // test the svg export with an additional file being exported (export of subprocesses is being selected)
  modal = await openModal(page, async () => {
    await page
      .locator(`tr[data-row-key="${subprocessDefinitionId}"]`)
      .getByRole('checkbox')
      .check();
    return page.getByRole('button', { name: /download/i }).click();
  });
  await modal.getByRole('button', { name: 'Download Diagram as SVG' }).click();
  await modal.getByRole('checkbox', { name: 'with collapsed subprocesses' }).click();
  const { filename: multiSvgFilename, content: svgZip } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'zip',
  );

  // check that a zip has been exported
  expect(multiSvgFilename).toMatch(/.zip$/);

  function getFolderName(definitionName: string) {
    return definitionName.split(' ').join('_');
  }
  function hasFolder(zipFile: typeof svgZip, folderName: string) {
    return Object.values(zipFile.files)
      .filter((file) => file.dir)
      .some((dir) => dir.name === folderName + '/');
  }

  // check that there is a folder for the process containing two svgs, one for the root layer and one for the subprocess layer
  expect(hasFolder(svgZip, getFolderName(subprocessDefinitionName))).toBeTruthy();
  expect(svgZip.file(getFolderName(subprocessDefinitionName) + '/' + 'latest.svg')).toBeTruthy();
  expect(
    svgZip.file(
      getFolderName(subprocessDefinitionName) + '/' + 'latest_subprocess_Activity_1iz0b2a.svg',
    ),
  ).toBeTruthy();

  // check that the svg files contain the expected content
  const rootSvg = await svgZip
    .file(getFolderName(subprocessDefinitionName) + '/' + 'latest.svg')!
    .async('string');

  expect(rootSvg).toMatch(/<svg/);
  expect(rootSvg).toMatch(/data-element-id="StartEvent_1inc7tc"/);
  expect(rootSvg).toMatch(/data-element-id="Flow_1nwk7gv"/);
  expect(rootSvg).toMatch(/data-element-id="Activity_1iz0b2a"/);
  expect(rootSvg).toMatch(/data-element-id="Flow_1q734k8"/);
  expect(rootSvg).toMatch(/data-element-id="Event_1n7bc2z"/);

  const subprocessSvg = await svgZip
    .file(getFolderName(subprocessDefinitionName) + '/' + 'latest_subprocess_Activity_1iz0b2a.svg')!
    .async('string');

  expect(subprocessSvg).toMatch(/<svg/);
  expect(subprocessSvg).toMatch(/data-element-id="Event_0ueb679"/);
  expect(subprocessSvg).toMatch(/data-element-id="Flow_0gdubli"/);
  expect(subprocessSvg).toMatch(/data-element-id="Activity_0hr3urx"/);
  expect(subprocessSvg).toMatch(/data-element-id="Flow_09xvh9n"/);
  expect(subprocessSvg).toMatch(/data-element-id="Event_0wq3coj"/);

  /* Deselect Process */
  await page
    .locator(`tr[data-row-key="${subprocessDefinitionId}"]`)
    .getByRole('checkbox')
    .uncheck();

  /*************************** PNG Export ********************************/

  // test the png export with only a single file
  modal = await openModal(page, async () => {
    await page.locator(`tr[data-row-key="${definitionId}"]`).getByRole('checkbox').check();
    return page.getByRole('button', { name: /download/i }).click();
  });
  await page.getByRole('button', { name: 'Download Diagram as PNG' }).click();
  const { filename: pngFilename, content: exportPng } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'string',
  );

  // check that a png has been exported
  expect(pngFilename).toMatch(/.png$/);

  /* Deselect Process */
  await page.locator(`tr[data-row-key="${definitionId}"]`).getByRole('checkbox').uncheck();

  // test the png export with an additional file being exported (export of subprocesses is being selected)
  modal = await openModal(page, async () => {
    await page
      .locator(`tr[data-row-key="${subprocessDefinitionId}"]`)
      .getByRole('checkbox')
      .check();
    return page.getByRole('button', { name: /download/i }).click();
  });
  await modal.getByRole('button', { name: 'Download Diagram as PNG' }).click();
  await modal.getByRole('checkbox', { name: 'with collapsed subprocesses' }).click();

  const { filename: multiPngFilename, content: pngZip } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'zip',
  );

  // check that a zip has been exported
  expect(multiPngFilename).toMatch(/.zip$/);

  // check that there is a folder for the process containing two pngs, one for the root layer and one for the subprocess layer
  expect(hasFolder(pngZip, getFolderName(subprocessDefinitionName))).toBeTruthy();
  expect(pngZip.file(getFolderName(subprocessDefinitionName) + '/' + 'latest.png')).toBeTruthy();
  expect(
    pngZip.file(
      getFolderName(subprocessDefinitionName) + '/' + 'latest_subprocess_Activity_1iz0b2a.png',
    ),
  ).toBeTruthy();
});

test('export multiple processes', async ({ processListPage }) => {
  const { page } = processListPage;

  const {
    definitionId: process1Id,
    definitionName: process1Name,
    bpmn: process1Bpmn,
  } = await processListPage.importProcess('process1.bpmn', undefined, setBpmnOriginalAttributes);
  const { definitionName: process2Name } = await processListPage.importProcess('process2.bpmn');
  const {
    definitionId: process3Id,
    definitionName: process3Name,
    bpmn: process3Bpmn,
  } = await processListPage.importProcess('process3.bpmn', undefined, setBpmnOriginalAttributes);

  /*************************** BPMN Export ********************************/

  // Select processes 1 and 3
  await page.locator(`tr[data-row-key="${process1Id}"]`).getByRole('checkbox').click();
  await page.locator(`tr[data-row-key="${process3Id}"]`).getByRole('checkbox').click();

  let modal = await openModal(page, () => page.getByRole('button', { name: /download/i }).click());

  await modal.getByRole('button', { name: 'Download Diagram as BPMN' }).click();

  const { filename, content: zip } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'zip',
  );

  expect(filename).toMatch(/.zip$/);

  function getFolderName(definitionName: string) {
    return definitionName.split(' ').join('_');
  }

  function hasFolder(zipFile: typeof zip, folderName: string) {
    return Object.values(zipFile.files)
      .filter((file) => file.dir)
      .some((dir) => dir.name === folderName + '/');
  }

  // check that there is a folder for each process that was selected for export and none for the one not selected
  expect(hasFolder(zip, getFolderName(process1Name))).toBeTruthy();
  expect(hasFolder(zip, getFolderName(process2Name))).toBeFalsy();
  expect(hasFolder(zip, getFolderName(process3Name))).toBeTruthy();

  // check that each folder contains the latest bpmn of the process
  expect(zip.file(getFolderName(process1Name) + '/' + 'latest.bpmn')).toBeTruthy();
  const process1FileContent = await zip
    .file(getFolderName(process1Name) + '/' + 'latest.bpmn')!
    .async('string');
  expect(await removeCreatorDefinitionAttributes(process1FileContent)).toBe(
    await removeCreatorDefinitionAttributes(process1Bpmn),
  );

  expect(zip.file(getFolderName(process3Name) + '/' + 'latest.bpmn')).toBeTruthy();
  const process3FileContent = await zip
    .file(getFolderName(process3Name) + '/' + 'latest.bpmn')!
    .async('string');
  expect(await removeCreatorDefinitionAttributes(process3FileContent)).toBe(
    await removeCreatorDefinitionAttributes(process3Bpmn),
  );
  /*************************** SVG Export ********************************/

  modal = await openModal(page, () => page.getByRole('button', { name: /download/i }).click());

  await modal.getByRole('button', { name: 'Download Diagram as SVG' }).click();
  await modal.getByRole('checkbox', { name: 'with collapsed subprocesses' }).click();

  const { filename: svgZipFilename, content: svgZip } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'zip',
  );

  expect(svgZipFilename).toMatch(/.zip$/);

  // check that there is a folder for each process that was selected for export and none for the one not selected
  expect(hasFolder(svgZip, getFolderName(process1Name))).toBeTruthy();
  expect(hasFolder(svgZip, getFolderName(process2Name))).toBeFalsy();
  expect(hasFolder(svgZip, getFolderName(process3Name))).toBeTruthy();

  // check that each folder contains the latest svg of the process
  expect(svgZip.file(getFolderName(process1Name) + '/' + 'latest.svg')).toBeTruthy();
  expect(svgZip.file(getFolderName(process3Name) + '/' + 'latest.svg')).toBeTruthy();
  expect(svgZip.file(getFolderName(process3Name) + '/' + 'latest_subprocess_X.svg')).toBeTruthy();
  expect(svgZip.file(getFolderName(process3Name) + '/' + 'latest_subprocess_Y.svg')).toBeTruthy();

  /*************************** PNG Export ********************************/

  modal = await openModal(page, () => page.getByRole('button', { name: /download/i }).click());

  await expect(page.getByTestId('Share Modal').getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Download Diagram as PNG' }).click();
  await modal.getByRole('checkbox', { name: 'with collapsed subprocesses' }).click();

  const { filename: pngZipFilename, content: pngZip } = await processListPage.handleDownload(
    async () =>
      await closeModal(modal, () =>
        modal.getByRole('button', { name: 'Download', exact: true }).click(),
      ),
    'zip',
  );

  expect(pngZipFilename).toMatch(/.zip$/);

  // check that there is a folder for each process that was selected for export and none for the one not selected
  expect(hasFolder(pngZip, getFolderName(process1Name))).toBeTruthy();
  expect(hasFolder(pngZip, getFolderName(process2Name))).toBeFalsy();
  expect(hasFolder(pngZip, getFolderName(process3Name))).toBeTruthy();

  // check that each folder contains the latest svg of the process
  expect(pngZip.file(getFolderName(process1Name) + '/' + 'latest.png')).toBeTruthy();
  expect(pngZip.file(getFolderName(process3Name) + '/' + 'latest.png')).toBeTruthy();
  expect(pngZip.file(getFolderName(process3Name) + '/' + 'latest_subprocess_X.png')).toBeTruthy();
  expect(pngZip.file(getFolderName(process3Name) + '/' + 'latest_subprocess_Y.png')).toBeTruthy();
});

test('toggle process list columns', async ({ processListPage }) => {
  const { page } = processListPage;

  const ColumnHeader = ['Description', 'Last Edited', 'Created On', 'Created By', 'Responsibility'];

  const toggleMenu = () =>
    page.getByRole('columnheader', { name: 'more' }).getByRole('button', { name: 'more' }).click();

  for (const column of ColumnHeader) {
    const checkbox = page.getByRole('checkbox', { name: column });

    await toggleMenu(); // open
    expect(checkbox).toBeVisible();
    if (!(await checkbox.isChecked())) await checkbox.check();
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    await toggleMenu(); // close

    await toggleMenu(); // open
    expect(checkbox).toBeVisible();
    if (await checkbox.isChecked()) await checkbox.uncheck();
    await expect(page.getByRole('columnheader', { name: column })).not.toBeVisible();
    await toggleMenu(); // close
  }
});

test('test that selected columns are persisted on reload', async ({ processListPage }) => {
  const { page } = processListPage;

  const VisibleColumns = ['ID', 'Description ', 'Last Edited '];
  const HiddenColumns = ['Created On ', 'Created By '];

  const toggleMenu = () =>
    page.getByRole('columnheader', { name: 'more' }).getByRole('button', { name: 'more' }).click();

  for (const column of VisibleColumns) {
    const checkbox = page.getByRole('checkbox', { name: column });

    await toggleMenu(); // open
    expect(checkbox).toBeVisible();
    if (!(await checkbox.isChecked())) await checkbox.check();
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    await toggleMenu(); // close
  }

  for (const column of HiddenColumns) {
    const checkbox = page.getByRole('checkbox', { name: column });

    await toggleMenu(); // open
    expect(checkbox).toBeVisible();
    if (await checkbox.isChecked()) await checkbox.uncheck();
    await expect(page.getByRole('columnheader', { name: column })).not.toBeVisible();
    await toggleMenu(); // close
  }

  await page.reload();

  for (const column of VisibleColumns) {
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
  }

  for (const column of HiddenColumns) {
    await expect(page.getByRole('columnheader', { name: column })).not.toBeVisible();
  }
});

test('create a new folder and remove it with context menu', async ({ processListPage }) => {
  const { page } = processListPage;
  const folderId = crypto.randomUUID();

  await page.getByRole('button', { name: 'No data No data' }).click({ button: 'right' });
  let modal = await openModal(page, () =>
    page.getByRole('menuitem', { name: 'Create Folder' }).click(),
  );
  await modal.getByLabel('Folder name').fill(folderId);
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());

  const folderLocator = page.getByText(folderId);
  await expect(folderLocator).toBeVisible();

  /* The playwright browser crops it's view which can cause unwanted scrolling */
  /* Clicking calls scrollIntoView before clicking, which can cause the context menu to close */
  /* Workauround: */
  await page.evaluate(() => window!.scrollTo(0, 0));
  await folderLocator.scrollIntoViewIfNeeded();

  folderLocator.click({ button: 'right' });
  const menuLocator = page.getByRole('menuitem', { name: 'delete Delete' });
  /* Confirm delete */
  modal = await openModal(page, () => menuLocator.click());
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());

  // await menuLocator.click();
  // await expect(menuLocator).not.toBeVisible(); //wait for context menu to close

  // NOTE: testing the folderLocator is flaky, because even after deletion the
  // popover with folder title can hang around for a short while.
  await expect(page.getByRole('cell', { name: 'folder ' + folderId })).not.toBeVisible();
});

test('create a new folder with new button and remove it', async ({ processListPage }) => {
  const { page } = processListPage;
  const folderId = crypto.randomUUID();

  // NOTE: this could easily break
  await page.getByRole('button', { name: 'ellipsis' }).click();
  let modal = await openModal(page, () =>
    page.getByRole('menuitem', { name: 'Create Folder' }).click(),
  );
  await modal.getByLabel('Folder name').fill(folderId);
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());

  const folderLocator = page.getByText(folderId);
  await expect(folderLocator).toBeVisible();

  const folderRow = await page.locator(`tr:has(td:has-text("${folderId}"))`);
  // await page.getByLabel('', { exact: true }).check();
  await folderRow.getByRole('checkbox').check();
  modal = await openModal(page, () => page.getByRole('button', { name: 'delete' }).click());
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());

  await expect(folderLocator).not.toBeVisible();
});

test('create a new folder and process, move process to folder and then delete both', async ({
  processListPage,
}) => {
  const { page } = processListPage;

  // create folder
  const folderId = crypto.randomUUID();
  await page.getByRole('button', { name: 'No data No data' }).click({ button: 'right' });
  let modal = await openModal(page, () =>
    page.getByRole('menuitem', { name: 'Create Folder' }).click(),
  );
  await modal.getByLabel('Folder name').fill(folderId);
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());
  const folderRow = page.locator(`tr:has(td:has-text("${folderId}"))`);
  await expect(folderRow).toBeVisible();

  // create process
  const processId = crypto.randomUUID();
  const processDefinitionID = await processListPage.createProcess({
    processName: processId,
    returnToProcessList: true,
  });

  const processLocator = page.locator(`tr[data-row-key="${processDefinitionID}"]`);
  await expect(processLocator).toBeVisible();

  // drag process to folder
  // await processLocator.dragTo(folderRow); /* What does this do? */
  await processLocator.hover();
  await page.mouse.down();
  await page.mouse.move(100, 100, { steps: 10 }); // needed to "start dragging" the element
  // Without "force: true" the check for hoverability can fail when the hover event is blocked by the drag-shadow
  await folderRow.hover({ force: true });
  await page.mouse.up();

  await expect(processLocator).not.toBeVisible();

  // go to folder page
  const nameCell = folderRow.locator(`td:has-text("${folderId}")`);
  await nameCell.click({ clickCount: 1 });
  await page.waitForURL(/\/processes\/folder\/([a-zA-Z0-9-_]+)/);

  // check for process and delete it
  await expect(processLocator).toBeVisible();
  modal = await openModal(page, async () => {
    await processLocator.getByRole('checkbox').check();
    await page.getByRole('button', { name: /delete/i }).click();
    // processLocator.getByRole('button', { name: 'delete' }).click()
  });
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());
  await expect(processLocator).not.toBeVisible();
  processListPage.getDefinitionIds().splice(0, 1);

  // go back and delete folder
  await page.goBack();
  modal = await openModal(page, async () => {
    await folderRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: /delete/i }).click();
    // folderRow.getByRole('button', { name: 'delete' }).click()
  });
  await closeModal(modal, () => modal.getByRole('button', { name: 'OK' }).click());
  await expect(folderRow).not.toBeVisible();
});

test.describe('shortcuts in process-list', () => {
  /* Create Process - ctrl / meta + enter */
  test('create and submit a new process with shortcuts', async ({ processListPage }) => {
    const { page } = processListPage;
    /* Open Modal with ctrl + enter */
    let modal = await openModal(page, () => page.getByRole('main').press('ControlOrMeta+Enter'));

    /* Check if Modal is visible */
    await expect(modal, 'New-Process-Modal should be openable via shortcuts').toBeVisible();

    /* Check if correct modal opened */
    let modalTitle = await modal.locator('div[class="ant-modal-title"]');
    await expect(modalTitle, 'Could not ensure that the correct modal opened').toHaveText(
      /create/i,
    );

    /* Close Modal with esc */
    await closeModal(modal, () => page.getByRole('main').press('Escape'));

    /* Check if Modal closed */
    await expect(modal, 'Modals should be closeable via Esc').not.toBeVisible();

    /* Open Modal with meta + enter */
    modal = await openModal(page, () => page.getByRole('main').press('ControlOrMeta+Enter'));

    /* Check if Modal opened */
    await expect(modal, 'New-Process-Modal should be openable via ctrl/meta+enter').toBeVisible();

    /* Check if correct modal opened */
    modalTitle = await modal.locator('div[class="ant-modal-title"]');
    await expect(modalTitle, 'Could not ensure that the correct modal opened').toHaveText(
      /create/i,
    );

    /* Fill in the form */
    await modal.press('Tab');
    await modal.press('Tab');
    await modal.getByLabel(/name/i).fill('Some Name');
    await modal.getByLabel(/name/i).press('Tab');
    await modal.getByLabel(/description/i).fill('Some Description');

    /* Submit form with ctrl + enter */
    await closeModal(modal, () => page.getByRole('main').press('ControlOrMeta+Enter'));

    /* Wait for Modeler to open */
    await page.waitForURL(
      /\/processes\/([a-zA-Z0-9-_]+)/,
    ); /* TODO: should this be an expect / is this part of the test? */
    // await expect(page, 'New-Process-Modal should be submitable via ctrl/meta+enter').toHaveURL(
    //   /\/processes\/([a-zA-Z0-9-_]+)/,
    // );

    /* Save Process-ID*/
    const processID = page.url().split('/').pop();

    await waitForHydration(page);

    /* Wait for modeler to load */
    await page.locator('svg[data-element-id^="Process_"]').waitFor({
      state: 'visible',
    });

    /* Go back to process list by pressing esc twice */
    await page.getByRole('main').press('Escape', { delay: 100 });
    await page.getByRole('main').press('Escape', { delay: 100 });

    /* The /processes page should be visibe again */
    // await expect(page, 'Modeler should be closable via esc+esc').toHaveURL(/\/processes/);
    await page.waitForURL('/processes');

    /* New created Process should be in List */
    await expect(
      page.locator(`tr[data-row-key="${processID}"]`),
      'Could not find newly added process in list',
    ).toBeVisible();

    // clean up the process
    await processListPage.removeProcess(processID);
  });
  /* Delete Process - del*/
  test('delete a process with del', async ({ processListPage }) => {
    const { page } = processListPage;
    /* Create Process */
    const processID = await processListPage.createProcess({
      processName: 'Delete me via shortcut',
      returnToProcessList: true,
    });

    /* Select Process */
    const processRowCheckbox = await page
      .locator(`tr[data-row-key="${processID}"]`)
      .getByRole('checkbox');
    await processRowCheckbox.check();

    /* Delete Process with del */
    const modal = await openModal(page, () => page.getByRole('main').press('Delete'));

    /* Confirm deletion */
    await closeModal(modal, () => page.getByRole('main').press('ControlOrMeta+Enter'));

    /* Check if Process was removed */
    await expect(
      page.locator('tbody>tr[class="ant-table-placeholder"]'),
      'Only the ant-design-placeholder row should be visible, if the list is empty',
    ).toBeVisible();

    /* Remove processId from processListPage */
    processListPage.processDefinitionIds = processListPage.processDefinitionIds.filter(
      (id) => id !== processID,
    );
  });

  /*  Select all Processes - ctrl / meta + a */
  test('select and deselect all processes with ctrl / meta + a & esc', async ({
    processListPage,
  }) => {
    const { page } = processListPage;
    /* Create 3 Processes */
    const processIDs = [];

    for (let i = 0; i < 3; i++) {
      processIDs.push(
        await processListPage.createProcess({
          processName: `Process ${i}`,
          returnToProcessList: true,
        }),
      );
    }

    /* Select all Processes with ctrl + a */
    await page.getByRole('main').press('ControlOrMeta+a');

    /* Check if all Processes are selected */
    for (const processID of processIDs) {
      await expect(
        page.locator(`tr[data-row-key="${processID}"]`),
        'Could not select all Processes in List with shortcut',
      ).toHaveClass(/ant-table-row-selected/);
    }

    /* Deselect all Processes with esc */
    await page.getByRole('main').press('Escape');

    /* Check if all Processes are deselected */
    for (const processID of processIDs) {
      await expect(
        page.locator(`tr[data-row-key="${processID}"]`),
        'Could not deselect in Process-List',
      ).not.toHaveClass(/ant-table-row-selected/);
    }

    /* Select all Processes with meta + a */
    await page.getByRole('main').press('Meta+a');

    /* Check if all Processes are selected */
    for (const processID of processIDs) {
      await expect(
        page.locator(`tr[data-row-key="${processID}"]`),
        'Could not select all Processes in List via shortcut (meta)',
      ).toHaveClass(/ant-table-row-selected/);
    }
  });

  /* Selecting all, just selects search-scoped processes */
  test('select all processes after search', async ({ processListPage }) => {
    const { page } = processListPage;

    /* Create 3 Processes */
    const processIDs = [];
    for (const name of ['AAAA1', 'AAAA2', 'XYZ']) {
      processIDs.push(
        await processListPage.createProcess({ processName: name, returnToProcessList: true }),
      );
    }

    /* Search for XYZ */
    const inputSearch = await page.locator('.ant-input-affix-wrapper');
    await inputSearch.getByPlaceholder(/search/i).fill('XYZ');

    /* Unfocus search */
    await page.getByRole('main').click();

    /* Select all */
    await page.locator('body').press('ControlOrMeta+a');

    /* Check if only XYZ is selected */
    await expect(page.getByRole('note')).toContainText('1');

    /*  Search for A */
    await inputSearch.getByPlaceholder(/search/i).fill('A');

    /* Unfocus search */
    await page.getByRole('main').click();

    /* Select all */
    await page.locator('body').press('Meta+a');

    /* Check if both AAA are selected */
    await expect(page.getByRole('note')).toContainText('2');

    // clear the search bar for the process cleanup to get all processes (.fill('') and .clear() open the delete modal in chrome for some reason)
    await inputSearch.getByPlaceholder(/search/i).focus();
    await inputSearch.getByPlaceholder(/search/i).press('Backspace');
  });

  /* Copy and Paste Processes - ctrl / meta + c -> ctrl / meta + v */
  test('copy and paste process with ctrl + c -> ctrl + v', async ({
    processListPage,
    browserName,
  }) => {
    const { page } = processListPage;
    const processName = 'Copy me via shortcut';

    /* Create a process */
    const processID = await processListPage.createProcess({
      processName: processName,
      returnToProcessList: true,
    });

    /* Select process */
    await page.locator(`input[name="${processID}"]`).click();

    /* Copy & Paste*/
    await page.getByRole('main').press('ControlOrMeta+c');
    const modal = await openModal(page, () => page.getByRole('main').press('ControlOrMeta+v'));

    /* Check if Modal is visible */
    await expect(modal, 'Could not open export modal with shortcut').toBeVisible();

    /* Check if correct modal opened */
    const modalTitle = await modal.locator('div[class="ant-modal-title"]');
    await expect(modalTitle, 'Could not ensure that the correct modal opened').toHaveText(/copy/i);

    /* Submit copy */
    await closeModal(modal, () => page.getByRole('main').press('ControlOrMeta+Enter'));

    /* Check if Process has been added */
    await expect(
      page.locator(
        'tbody>tr:not(.ant-table-measure-row)',
      ) /* Ant-Design added a measure row -> ignore */,
      'Could not find copied process in Process-List',
    ).toHaveCount(2);
    /* Check with name */
    await expect(page.locator('tbody')).toContainText(processName + ' (Copy)');

    /* Copy & Paste - META */
    await page.getByRole('main').press('Meta+c');
    const modal2 = await openModal(page, () => page.getByRole('main').press('Meta+v'));
    /* Make name unique */
    await modal2.press('Tab');
    await modal2.press('Tab');
    await modal2.getByLabel(/name/i).press('ArrowRight');
    await modal2.getByLabel(/name/i).fill(processName + ' - Meta');

    /* Check if Modal is visible */
    await expect(modal2, 'Could not open copy modal with shortcut (meta)').toBeVisible();

    /* Check if correct modal opened */
    const modalTitle2 = await modal2.locator('div[class="ant-modal-title"]');
    await expect(modalTitle2, 'Could not ensure that the correct modal opened').toHaveText(/copy/i);

    /* Submit copy */
    if (browserName !== 'firefox') {
      await closeModal(modal2, () => page.getByRole('main').press('Meta+Enter'));
    } else {
      await modal2.click();
      await closeModal(modal2, () => page.getByRole('main').press('Meta+Enter'));
    }

    /* Check if Process has been added */
    await expect(page.locator('tbody>tr:not(.ant-table-measure-row)')).toHaveCount(
      3,
    ); /* Ignore measurement row */
    /* Check with name */
    await expect(page.locator('tbody')).toContainText(processName + ' - Meta');
  });

  test('copy and paste multiple processes with ctrl + c -> ctrl + v', async ({
    processListPage,
    browserName,
  }) => {
    const { page } = processListPage;

    /* Create a process */
    const names = ['A', 'B'];
    const processIDs = [];
    for (const name of names) {
      processIDs.push(
        await processListPage.createProcess({
          processName: name,
          returnToProcessList: true,
        }),
      );
    }

    /* Select all processes */
    await page.getByRole('main').press('ControlOrMeta+a');

    /* Copy & Paste*/
    await page.getByRole('main').press('ControlOrMeta+c');
    await page.getByRole('main').press('ControlOrMeta+v');

    await page.waitForTimeout(1_000); /* Ensure that animation is over */

    /* Check if Modal is visible */
    const modal = await page.getByRole('dialog');
    await expect(modal, 'Could not open export modal with shortcut').toBeVisible();

    /* Check if correct modal opened */
    const modalTitle = await modal.locator('div[class="ant-modal-title"]');
    /* Title has copy in it */
    await expect(modalTitle, 'Could not ensure that the correct modal opened').toHaveText(/copy/i);
    /* Multiple processes */
    const tablistNumberOfEntries = await modal.getByRole('tablist').locator('>div').count();
    await expect(
      tablistNumberOfEntries,
      'Could not ensure that multiple processes are copied',
    ).toBe(2);

    /* Submit copy */
    if (browserName !== 'firefox') {
      await page.getByRole('main').press('Control+Enter');
    } else {
      await modal.click();
      await page.locator('body').press('Control+Enter');
    }

    await page.waitForTimeout(1_000); /* Ensure that animation is over */

    /* Check if Processes have been added */
    await expect(page.locator('tbody>tr:not(.ant-table-measure-row)')).toHaveCount(
      4,
    ); /* Ignore measurement row */

    /* Check with names */
    for (const name of names) {
      await expect(page.locator('tbody')).toContainText(name + ' (Copy)');
    }
  });

  /* Open Export Modal - ctrl / meta + e */
  test('open export modal with ctrl / meta + e', async ({ processListPage }) => {
    const { page } = processListPage;

    /* Create a process */
    const processID = await processListPage.createProcess({
      processName: 'Export me via shortcut',
      returnToProcessList: true,
    });

    /* Select process */
    await page.locator(`input[name="${processID}"]`).click();

    /* Open Export Modal with ctrl + e */
    const modal = await openModal(page, () => page.getByRole('main').press('ControlOrMeta+e'));

    /* Check if Modal is visible */
    expect(modal, 'Could not open delete modal with shortcut').toBeVisible();

    /* Check if correct modal opened */
    const modalTitle = await modal.locator('div[class="ant-modal-title"]');
    await expect(modalTitle, 'Could not ensure that the correct modal opened').toHaveText(/Share/i);

    // close modal to allow cleanup to work as expected
    await closeModal(modal, () => modal.getByRole('button', { name: 'Close' }).click());
  });
});

test.describe('Click-Controls in Process-List', () => {
  test('Select multiple with ctrl / meta and click', async ({ processListPage }) => {
    const { page } = processListPage;
    const selectedColour = 'rgb(235, 248, 255)';

    /* Create 2 Processes */
    const namens = ['A', 'B'];
    const processIDs = [];
    for (const name of namens) {
      processIDs.push(
        await processListPage.createProcess({
          processName: 'Process ' + name,
          returnToProcessList: true,
        }),
      );
    }

    /* Switch to Icon-View */
    await page.getByRole('button', { name: 'appstore' }).click();

    /* Variables */
    const counter = await page.getByRole('note');
    const processA = await page.getByRole('button', { name: /Process A/ });
    const processB = await page.getByRole('button', { name: /Process B/ });

    /* Click on Process B */
    processB.click();
    /* Check if selected */
    /* Selected Counter */
    await expect(counter).toContainText('1');
    /* Blue outline */
    await expect(
      processB.locator('.ant-card'),
      'Could not select a Process in Icon-List with normal click',
    ).toHaveCSS('background-color', selectedColour);

    /* Deselect by clicking with ctrl */
    await page.getByRole('button', { name: /Process B/ }).click({ modifiers: ['ControlOrMeta'] });
    /* Check if deselected */
    /* Selected Counter not visible */
    await expect(counter).not.toBeVisible();
    /* Blue outline */
    await expect(
      processB.locator('.ant-card'),
      'Could not deselect a Process in Icon-List with ctrl+click',
    ).not.toHaveCSS('background-color', selectedColour);

    /* Select again with ctrl */
    await page.getByRole('button', { name: /Process B/ }).click({ modifiers: ['ControlOrMeta'] });
    /* Check if selected again */
    /* Selected Counter */
    await expect(counter).toContainText('1');
    /* Blue outline */
    await expect(
      processB.locator('.ant-card'),
      'Could not select a Process in Icon-List with ctrl+click',
    ).toHaveCSS('background-color', selectedColour);

    /* Select Process A */
    processA.click();
    /* Check if A selected and B not selected */
    /* Selected Counter */
    await expect(counter).toContainText('1');
    /* Blue outline */
    await expect(
      processA.locator('.ant-card'),
      'Could not select a Process in Icon-List with normal click',
    ).toHaveCSS('background-color', selectedColour);
    await expect(
      processB.locator('.ant-card'),
      'Could not deselect a Process in Icon-List with normal click',
    ).not.toHaveCSS('background-color', selectedColour);

    /* Additionally select Process B */
    await page.getByRole('button', { name: /Process B/ }).click({ modifiers: ['ControlOrMeta'] });
    /* Check if A and B are selected */
    /* Selected Counter */
    await expect(counter).toContainText('2');
    /* Blue outline */
    await expect(
      processA.locator('.ant-card'),
      'Could not select multiple Processes in Icon-List with ctrl+click',
    ).toHaveCSS('background-color', selectedColour);
    await expect(
      processB.locator('.ant-card'),
      'Could not select multiple Processes in Icon-List with ctrl+click',
    ).toHaveCSS('background-color', selectedColour);

    /* Deselect all Processes with esc */
    await page.getByRole('main').press('Escape');
    /* Check if deselected */
    /* Selected Counter */
    await expect(counter).not.toBeVisible();
    /* Blue outline */
    await expect(
      processA.locator('.ant-card'),
      'Could not deselect all Processes in Icon-List with esc',
    ).not.toHaveCSS('background-color', selectedColour);
    await expect(
      processB.locator('.ant-card'),
      'Could not deselect all Processes in Icon-List with esc',
    ).not.toHaveCSS('background-color', selectedColour);
  });

  test('Drag select with shift + click', async ({ processListPage }) => {
    const { page } = processListPage;
    const selectedColour = 'rgb(235, 248, 255)';

    /* Create 4 Processes */
    const namens = ['A', 'B', 'C', 'D'];
    const processIDs = [];
    for (const name of namens) {
      processIDs.push(
        await processListPage.createProcess({
          processName: 'Process ' + name,
          returnToProcessList: true,
        }),
      );
    }

    /* Switch to Icon-View */
    await page.getByRole('button', { name: 'appstore' }).click();

    /* Variables */
    const counter = page.getByRole('note');

    // Since the order that the objects will appear on the list isn't predictable, we just index
    // them by their order instead of their name
    const processes = page.getByRole('button', { name: /Process [A-Z]/, exact: true });
    expect(processes).toHaveCount(4);

    const processA = processes.nth(0);
    const processB = processes.nth(1);
    const processC = processes.nth(2);
    const processD = processes.nth(3);

    /* Select B (while pressing shift) */
    await processB.click({ modifiers: ['Shift'] });
    /* Check if B is selected */
    /* Selected Counter */
    await expect(counter).toContainText('1');
    /* Blue outline */
    await expect(
      processB.locator('.ant-card'),
      'Could not select a Process in Icon-List with shift+click',
    ).toHaveCSS('background-color', selectedColour);

    /* Drag select until C */
    await processC.click({ modifiers: ['Shift'] });
    /* Check if B and C are selected */
    /* Selected Counter */
    await expect(counter).toContainText('2');
    /* Blue outline */
    for (const process of [processB, processC]) {
      await expect(
        process.locator('.ant-card'),
        'Could not select multiple Processes in Icon-List with shift+click',
      ).toHaveCSS('background-color', selectedColour);
    }

    /* Drag select until D */
    await processD.click({ modifiers: ['Shift'] });
    /* Check if B, C and D are selected */
    /* Selected Counter */
    await expect(counter).toContainText('3');
    /* Blue outline */
    for (const process of [processB, processC, processD]) {
      await expect(
        process.locator('.ant-card'),
        'Could not select multiple Processes in Icon-List with shift+click',
      ).toHaveCSS('background-color', selectedColour);
    }

    /* Deselect C */
    await processC.click({ modifiers: ['ControlOrMeta'] });
    /* Check if B and D are selected */
    /* Selected Counter */
    await expect(counter).toContainText('2');
    /* Blue outline */
    for (const process of [processB, processD]) {
      await expect(
        process.locator('.ant-card'),
        'Could not deselect a Process in Icon-List with ctrl+click',
      ).toHaveCSS('background-color', selectedColour);
    }

    /* Select range(A,D) by shift clicking A */
    await processA.click({ modifiers: ['Shift'] });
    /* Check if A, B, C, D are selected */
    /* Selected Counter */
    await expect(counter).toContainText('4');
    /* Blue outline */
    for (const process of [processA, processB, processC, processD]) {
      await expect(
        process.locator('.ant-card'),
        'Could not select multiple Processes in Icon-List with shift+click',
      ).toHaveCSS('background-color', selectedColour);
    }
  });
});

test.describe('Favourites', () => {
  test('Add new Favourite as Guest and receive info message', async ({ processListPage }) => {
    const { page } = processListPage;

    /* Create a Process */
    const processID = await processListPage.createProcess({
      processName: 'Favourite Process',
      returnToProcessList: true,
    });

    /* Star it */
    await page
      .locator(`tr[data-row-key="${processID}"]`)
      .getByRole('img', { name: /star/i })
      .click();

    /* Check if Info-Message is displayed */
    const message = await page.locator('.ant-message-info');
    /* Check if visible */
    await expect(message).toBeVisible();
    /* Check if it contains appropriate words */
    await expect(message).toContainText(
      /(?=.*[sign in|log in])(?=.*[need|have to])(?=.*[save|store|persist])/i,
    );
  });

  /* TODO: */
  // test.describe('Favourites as logged in user', () => {
  //   test.beforeAll(async ({ processListPage }) => {
  //     /* Login */
  //     // TODO: Login as Jane Doe
  //     console.log('Login as Jane Doe');
  //   });

  //   /* TODO: Uncomment once logged in as jane doe  */
  //   test('Favourites persist after login', async ({ processListPage }) => {
  //     const { page } = processListPage;

  //     /* Create a Process and a Folder */
  //     const processID = await processListPage.createProcess({
  //       processName: 'Favourite Process',
  //       returnToProcessList: true,
  //     });
  //     const folderID = await processListPage.createFolder({ folderName: 'Favourite Folder' });

  //     /* Star them */
  //     await page
  //       .locator(`tr[data-row-key="${processID}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();
  //     await expect(
  //       page.locator(`tr[data-row-key="${processID}"]`).getByLabel('star'),
  //       'Favourite Process should still be favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');

  //     const folderStar = await page
  //       .locator(`tr[data-row-key="${folderID}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();
  //     await expect(
  //       page.locator(`tr[data-row-key="${folderID}"]`).getByLabel('star'),
  //       'Favourite Folder should still be favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');

  //     /* Reload page */
  //     await page.reload();

  //     /* Check if Favourites are still there */
  //     await expect(
  //       page.locator(`tr[data-row-key="${processID}"]`).getByLabel('star'),
  //       'Favourite Process should still be favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');
  //     await expect(
  //       page.locator(`tr[data-row-key="${folderID}"]`).getByLabel('star'),
  //       'Favourite Folder should still be favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');

  //     /* Now Remove them from favourites and check if it persists over reloads */

  //     /* Unstar them */
  //     await page
  //       .locator(`tr[data-row-key="${processID}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();
  //     await expect(
  //       page.locator(`tr[data-row-key="${processID}"]`).getByLabel('star'),
  //       'Favourite Process should not be favourite anymore',
  //     ).not.toHaveCSS('color', 'rgb(255, 215, 0)');
  //     await page
  //       .locator(`tr[data-row-key="${folderID}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();
  //     await expect(
  //       page.locator(`tr[data-row-key="${folderID}"]`).getByLabel('star'),
  //       'Favourite Folder should not be favourite anymore',
  //     ).not.toHaveCSS('color', 'rgb(255, 215, 0)');

  //     /* Reload page */
  //     await page.reload();

  //     /* Check if Favourites are still there */
  //     await expect(
  //       page.locator(`tr[data-row-key="${processID}"]`).getByLabel('star'),
  //       'Favourite Process should not be favourite anymore',
  //     ).not.toHaveCSS('color', 'rgb(255, 215, 0)');
  //     await expect(
  //       page.locator(`tr[data-row-key="${folderID}"]`).getByLabel('star'),
  //       'Favourite Folder should not be favourite anymore',
  //     ).not.toHaveCSS('color', 'rgb(255, 215, 0)');
  //   });

  //   test('Sort by Favourites', async ({ processListPage }) => {
  //     const { page } = processListPage;
  //     const names = ['A', 'B', 'C'];
  //     /* Create 3 Processes */
  //     const processIDs = [];
  //     for (const name of names) {
  //       processIDs.push(
  //         await processListPage.createProcess({
  //           processName: 'Process ' + name,
  //           returnToProcessList: true,
  //         }),
  //       );
  //     }

  //     /* Create 3 Folders */
  //     const folderIDs = [];
  //     for (const name of names) {
  //       folderIDs.push(await processListPage.createFolder({ folderName: 'Folder ' + name }));
  //     }

  //     /* Make middle ones favourites */
  //     await page
  //       .locator(`tr[data-row-key="${processIDs[1]}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();

  //     /* Check if golden stars are visible */
  //     await expect(
  //       page.locator(`tr[data-row-key="${processIDs[1]}"]`).getByLabel('star'),
  //       'Could not make process favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');

  //     /* Same for folder */
  //     await page
  //       .locator(`tr[data-row-key="${folderIDs[1]}"]`)
  //       .getByRole('img', { name: /star/i })
  //       .click();

  //     await expect(
  //       page.locator(`tr[data-row-key="${folderIDs[1]}"]`).getByLabel('star'),
  //       'Could not make folder favourite',
  //     ).toHaveCSS('color', 'rgb(255, 215, 0)');

  //     /* Sort */
  //     const allRows = await page.locator('tbody tr').all();
  //     /* First click - ascending */
  //     await page.locator('th').nth(1).click();

  //     /* Check if correct order */
  //     await expect(allRows[0], 'Could not sort Favourite-Folders ascending').toContainText(
  //       'Folder B',
  //     );
  //     await expect(
  //       allRows[names.length],
  //       'Could not sort Favourite-Processes ascending',
  //     ).toContainText('Process B');

  //     /* Second click - descending */
  //     await page.locator('th').nth(1).click();

  //     /* Check if correct order */
  //     await expect(
  //       allRows[names.length - 1],
  //       'Could not sort Favourite-Folders descending',
  //     ).toContainText('Folder B');
  //     await expect(
  //       allRows[names.length * 2 - 1],
  //       'Could not sort Favourite-Processes descending',
  //     ).toContainText('Process B');
  //   });
  // });
});
// test('Resizing columns', async ({ processListPage }) => {
//   const { page } = processListPage;

//   /**
//    * Columns that are resizeable:
//    * Name         - visible
//    * Description  - visible
//    * Last Edited  - visible
//    * Created On
//    * File Size
//    * Owner
//    */

//   const selectableCols = ['Description', 'Last Edited', 'Created On', 'File Size', 'Owner'];
//   const getColumnwidth = (column: string) => {
//     return page
//       .getByRole('columnheader', { name: column })
//       .boundingBox()
//       .then((box) => box.width);
//   };

//   /* Select only Name */
//   await page
//     .getByRole('columnheader', { name: 'more' })
//     .getByRole('button', { name: 'more' })
//     .click();

//   for (const column of selectableCols) {
//     const checkbox = page.getByRole('checkbox', { name: column });

//     if (await checkbox.isChecked()) await checkbox.uncheck();
//     await expect(page.getByRole('columnheader', { name: column })).not.toBeVisible();
//   }

//   /* Resize Name */
//   const nameColumn = await page.getByRole('columnheader', { name: 'Name' });
//   const nameColumnHandle = await nameColumn.locator('span').last();

//   await expect(nameColumnHandle, `Could not find handle for 'Name' column`).toHaveClass(
//     /react-resizable-handle/i,
//   );

//   /* Get width of the column */
//   const nameColumnWidth = await getColumnwidth('Name');
//   console.log('Name Column Width:', await getColumnwidth('Name'));

//   const emptyCol = await page.locator('div.PROCEED-RESIZE-COLUMN');

/* Resize the column */
/* ________________________________________________________ */
// /* A */
// await nameColumnHandle.dragTo(emptyCol, {
//   sourcePosition: {
//     x: -20,
//     y: 2,
//   },
//   targetPosition: {
//     x: 50,
//     y: 1,
//   },
//   force: true,
// });
// /* ________________________________________________________ */
// /* B */
// let x, y;
// await nameColumnHandle.boundingBox().then((box) => {
//   x = box.x + box.width * 0.5;
//   y = box.y + box.height * 0.5;
// });

// await nameColumnHandle.hover();
// await page.mouse.down();
// await page.mouse.move(x + 100, y), { steps: 10 };
// await page.mouse.up();
// /* ________________________________________________________ */

//   // // await nameColumnHandle.hover();
//   // await page.mouse.move(x, y);
//   // await page.mouse.down();
//   // await page.mouse.move(x + 50, y, { steps: 10 });
//   // await page.mouse.up();

//   await console.log('Name Column Width:', await getColumnwidth('Name'));
// });
test.describe('Selecting Processes', () => {
  test.slow(); // triples test time (see https://playwright.dev/docs/test-timeouts)

  /* When copying many processes, not all of them will be added to processListPage.definitionsIDs, hence, we track the number of added processes */
  let numberOfProcesses = 0;
  const getNumberOfSelectedProcesses = async (page: Page) => {
    return Number.parseInt(await page.getByRole('note').textContent());
  };

  test.beforeEach(async ({ processListPage }) => {
    numberOfProcesses = 0;
    const { page } = processListPage;
    /* TODO: The number of processes necessary to cause second page depends on viewport height */
    /* Create 10 processes + XYZ Process ( =11) */
    for (let i = 1; i <= 3; i++) {
      await processListPage.createProcess({
        processName: `Process ${i}`,
        returnToProcessList: true,
      });
      numberOfProcesses++;
    }

    /* Copy + Paste until multiple pages */
    while ((await page.locator('.ant-pagination-next').getAttribute('aria-disabled')) === 'true') {
      await page.getByRole('main').press('ControlOrMeta+a');
      const adding = await getNumberOfSelectedProcesses(page);

      await page.getByRole('main').press('ControlOrMeta+c');
      const modal = await openModal(page, () => page.getByRole('main').press('ControlOrMeta+v'));
      await closeModal(modal, () => page.getByRole('main').press('ControlOrMeta+Enter'));

      numberOfProcesses += adding;
    }

    /* Add Copies to processListPage.processDefinitionIds */
    /* Search for '(Copy)' */
    const inputSearch = await page.locator('.ant-input-affix-wrapper').getByPlaceholder(/search/i);
    await inputSearch.fill('(Copy)');

    /* Get their ids */
    const visibleIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('tr[data-row-key]')).map((el) =>
        el.getAttribute('data-row-key'),
      ),
    );
    processListPage.processDefinitionIds.push(...visibleIds);

    /* Clear Search */
    await inputSearch.focus();
    await inputSearch.fill('');
    await page.getByRole('main').press('Escape');

    /* Deselect */
    await page.locator('body').press('Escape');

    // /* Add XYZ */
    await processListPage.createProcess({
      processName: 'XYZ',
      returnToProcessList: true,
    });
    numberOfProcesses++;
  });

  const getNumberOfVisibleRows = async (page: Page) => {
    return await page.locator('tbody>tr:not(.ant-table-measure-row)').count(); // Ignore measurement row
  };

  test('Selecting Processes with click', async ({ processListPage }) => {
    const { page } = processListPage;
    const inputSearch = await page.locator('.ant-input-affix-wrapper');

    const processIDs = processListPage.getDefinitionIds();
    /* ____________________________________ */
    /* Selection persists after page change */
    /* Select the first process*/
    const firstRow = await page.locator(`tr[data-row-key="${processIDs[0]}"]`);
    await firstRow.locator(`input[name="${processIDs[0]}"]`).click();
    const indicator = await page.getByRole('note');
    const xyzProcessId = processIDs[processIDs.length - 1];

    /* Check if selected */
    await expect(firstRow, 'Could not select first process').toHaveClass(/ant-table-row-selected/);
    await expect(indicator).toContainText('1');

    const nextButton = await page.getByRole('button', { name: 'right' }),
      prevButton = await page.getByRole('button', { name: 'left', exact: true });

    /* Change page */
    await nextButton.click();

    /* Check if selection persists */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(0);
    await expect(indicator).toContainText('1');

    /* Select all visible works as well */
    await page.getByLabel('Select all').check();

    /* Check */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(
      await getNumberOfVisibleRows(page),
    );
    await expect(indicator).toContainText(`${(await getNumberOfVisibleRows(page)) + 1}`);

    /* Deselect all visible */
    await page.getByLabel('Select all').uncheck();

    /* Check */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(0);
    await expect(indicator).toContainText('1');

    /* ____________________________________ */
    /* Selection persist after search */
    /* Search for 'XYZ' (last process) */
    await inputSearch.getByPlaceholder(/search/i).fill('XYZ');

    /* Make sure to be on the first page */
    await prevButton.click();

    /* Select the process (that should be visible now) element in table */
    await page.locator(`input[name="${xyzProcessId}"]`).check();

    /* Check */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(1);
    await expect(indicator).toContainText('2');

    /* Deselect the XYZ Process */
    await page.locator(`input[name="${xyzProcessId}"]`).uncheck();

    /* Check */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(0);
    await expect(indicator).toContainText('1');

    /* Select all visible works as well */
    await page.getByLabel('Select all').check();

    /* Check */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(
      await getNumberOfVisibleRows(page),
    );
    await expect(indicator).toContainText(`${(await getNumberOfVisibleRows(page)) + 1}`);

    /* ____________________________________ */
    /* Selection persists after folder change (? TODO:) */
  });
  test('Selecting Processes over multiple table pages with shortcuts', async ({
    processListPage,
  }) => {
    const { page } = processListPage;

    /* Select all with ctrl + a */
    await page.getByRole('main').press('ControlOrMeta+a');

    /* Check if all visible selected */
    await expect(page.locator('.ant-table-row-selected')).toHaveCount(
      await getNumberOfVisibleRows(page),
    );

    /* Check if displayed note show correct number */
    await expect(await page.getByRole('note')).toContainText(`${numberOfProcesses}`);
  });
});
