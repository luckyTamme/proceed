import { Editor, Frame } from '@craftjs/core';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import * as Elements from './elements';
import { CanEditContext } from '../modeler';

const styles = `
body {
  font-size: 16px;
  line-height: 1.5;
  font-family: Verdana, Arial, Helvetica, sans-serif;
}

.user-task-form-column {
  flex: 1 0 0;
  box-sizing: border-box;
  height: fit-content;
  border: 2px solid rgba(0,0,0,0);
  padding: 0 10px;
}

@media only screen and (max-width: 600px) {
  .user-task-form-column {
    flex: 0 0 100%;
  }
}

.user-task-form-row {
  box-sizing: border-box;
  width: 100%;
  padding: 5px;
  margin: 5px 0;
  display: flex;
  flex-wrap: wrap;
}

.user-task-form-container {
  min-height: 100%;
  border-radius: 8px;
}

.user-task-form-input {
  width: 100%;
}

.user-task-form-input > div {
  max-width: 100%;
  padding-bottom: 0.5rem;
  margin: 0;
  font-size: 1rem;
}

.user-task-form-input label span {
  white-space: nowrap !important;
}

.user-task-form-input input {
  box-sizing: border-box;
  width: 100%;
  height: fit-content;
  border: 1px solid #d9d9d9;
  padding: 4px 11px;
  font-size: 0.875em;
  line-height: 1.5714;
  border-radius: 0.375rem;
}

.user-task-form-table {
  text-align: left;
  width: 100%;
  border: 1px solid lightgrey;
  border-collapse: collapse;
  border-radius: 0.5rem 0.5rem 0 0;
}

.user-task-form-table .user-task-form-table-cell {
  padding: 0.75rem 0.5rem;
  border: 1px solid lightgrey;
  position: relative;
  font-weight: normal;
}

.user-task-form-input-group {
  position: relative;
  width: fit-content;
}

.user-task-form-input-group label, .user-task-form-input-group input {
  cursor: pointer;
}

.user-task-form-input-group-member {
  display: flex;
  align-items: center;
}

.user-task-form-input-group input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 3px 3px 6px 0;
}

.user-task-form-input-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 3px 3px 6px 0;
}

.user-task-form-milestone label {
  display: flex;
  align-items: center;
}

.user-task-form-milestone input[type="range"] {
  margin: 5px 10px;
}

.user-task-form-button {
  background-color: #eee;
  box-shadow: rgba(0,0,0, 0.02) 0 2px 0 0;
  padding: 4px 15px;
  border-radius: 6px;
  border: 1px solid lightgrey;
}

.user-task-form-button.primary-button {
  box-shadow: rgba(5, 145, 255, 0.1) 0 2px 0 0;
  background-color: rgb(22, 119, 255);
  color: white;
  border-color: rgb(22, 119, 255);
}

.user-task-form-image {
  width: 100%;
  display: flex;
  justify-content: center;
}

.user-task-form-image img {
  max-width: 100%;
}

p, h1, h2, h3, h4, h5, th, td {
  cursor: default;
}

.text-style-bold {
  font-weight: 700;
}

.text-style-italic {
  font-style: italic;
}

.text-style-underline {
  text-decoration: underline;
}

.text-style-paragraph {
  margin: 0;
}

.text-style-heading {
  font-weight: normal;
}

.text-style-link {
  text-decoration: none;
}

`;

export function toHtml(json: string) {
  const markup = ReactDOMServer.renderToStaticMarkup(
    <CanEditContext.Provider value={true}>
      <Editor
        enabled={false}
        resolver={{
          ...Elements,
          Image: Elements.ExportImage,
          Input: Elements.ExportInput,
          Milestones: Elements.ExportMilestones,
        }}
      >
        <Frame data={json} />
      </Editor>
      ,
    </CanEditContext.Provider>,
  );

  return `
  <!DOCTYPE html>
<html>
  <head>
    <style>
      ${styles}
    </style>
    <script>
      {script}
    </script>
  </head>
  <body>
    <form class="form">
      ${markup}
    </form>
  </body>
</html>
  `;
}

export const iframeDocument = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      html, body, #mountHere, .frame-content {
        height: 100%;
        width: 100%;
        overflow-x: hidden;
      }

      body {
        margin: 0;
      }

      .frame-content > div {
        box-sizing: border-box;
        padding: 0 10px;
      }

      .user-task-form-column {
        position: relative;
      }

      .user-task-form-container svg {
        height: 50px;
      }

      .user-task-form-image {
        position: relative;
      }

      .user-task-form-button {
        position: relative;
      }

      .user-task-form-image > div {
        position: absolute;
        background-color: rgba(0, 0, 0, 0.5);
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .user-task-form-image > div > span {
        margin: 0 10px;
        cursor: pointer;
        color: white;
      }

      .overlay-mask {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        color: white;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        background-color: rgba(0,0,0,0.5);
      }

      .overlay-control-icon {
        margin: 0 3px;
      }

      .overlay-control-icon > span {
        display: block;
        height: 16px;
      }

      .overlay-control-icon svg {
        height: fit-content;
      }

      .target-sub-element {
        background-color: rgba(255,255,0,0.33);
      }

      .sub-element-add-preview {
        background-color: rgba(0,255,0,0.33);
      }

      .sub-element-remove-preview {
        background-color: rgba(255,0,0,0.33);
      }

      ${styles}
    </style>
  </head>
  <body>
    <div id="mountHere">
    </div>
  </body>

</html>
`;

export const defaultForm = `
{
  "ROOT": {
    "type": { "resolvedName": "Container" },
    "isCanvas": true,
    "props": {
      "padding": 10,
      "background": "#fff",
      "borderThickness": 0,
      "borderColor": "#d3d3d3"
    },
    "displayName": "Container",
    "custom": {},
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  }
}
`;
