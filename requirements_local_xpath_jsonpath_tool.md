# Requirements Specification: Local XPath/JSONPath Extraction Web Application

## Objective

Develop a locally executable web application for extracting and selecting XPath or JSONPath expressions from a user-provided XML or JSON document. The application should minimize dependencies on external servers or backend services (e.g., Docker containers) and be able to run as a standalone webpage.

## Requirements

### General

- The application should run entirely in the browser (e.g., by opening an `.html` file).
- External dependencies must be avoided or kept to a minimum (no Docker, no server-side processing).
- The application must support both:
  - **XML**
  - **JSON**

### Functionality

#### Input Field

- A large text area for users to paste XML or JSON content.

#### Element Detection

- For **XML**:
  - All elements in the XML document should be automatically identified and displayed as **XPath expressions**.
  - XPaths should be listed with checkboxes.
  - Users can select which XPaths they want to use.

- For **JSON**:
  - The same behavior applies, but based on **JSONPath expressions**.
  - No namespace handling is required.

#### Output Fields

##### Field 1: `DynamicCustomHeaderXMLNamespace`

- Relevant only for XML.
- If any of the selected XPath expressions use namespace prefixes, the corresponding namespace declarations should be extracted from the XML document.
- The extracted namespaces should be formatted as `prefix=namespaceURI`, separated by semicolons, and displayed in this field.

##### Field 2: `DynamicCustomHeader`

- Contains the selected element names along with their full XPath or JSONPath.
- The output should be a list of entries, each with the element name and its corresponding path.

## Non-Functional Requirements

- No backend, no cloud connectivity, and no persistent storage required.
- All logic should be executed client-side in the browser.
- The application should work in modern browsers (Chrome, Firefox, Safari).

## Example Workflow

1. User opens the HTML file in a browser.
2. User pastes XML or JSON content into the input field.
3. The application analyzes the input and displays all extracted paths with checkboxes.
4. User selects the desired paths.
5. The `DynamicCustomHeader` and `DynamicCustomHeaderXMLNamespace` fields are automatically populated.