// Jest setup file for DOM mocking and test utilities

// Mock DOM APIs that might not be available in jsdom
global.DOMParser = global.DOMParser || window.DOMParser;
global.XMLSerializer = global.XMLSerializer || window.XMLSerializer;

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  },
  writable: true
});

// Mock file API
global.File = global.File || class File {
  constructor(parts, filename, options = {}) {
    this.parts = parts;
    this.name = filename;
    this.type = options.type || '';
    this.size = parts.reduce((total, part) => total + (part.length || 0), 0);
    this.lastModified = Date.now();
  }
};

global.FileReader = global.FileReader || class FileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onloadend = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = file.parts.join('');
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    }, 0);
  }
};

// Mock drag and drop APIs
global.DataTransfer = global.DataTransfer || class DataTransfer {
  constructor() {
    this.files = [];
    this.items = [];
    this.types = [];
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidXPath(received) {
    const isValid = typeof received === 'string' && 
                   received.length > 0 && 
                   !received.includes('undefined');
    return {
      message: () => `expected ${received} to be a valid XPath`,
      pass: isValid
    };
  },
  
  toBeValidJSONPath(received) {
    const isValid = typeof received === 'string' && 
                   (received.startsWith('$') || received.startsWith('$.'));
    return {
      message: () => `expected ${received} to be a valid JSONPath`,
      pass: isValid
    };
  }
});

// Global test utilities
global.createMockXMLDocument = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

global.createMockFile = (content, filename, type) => {
  return new File([content], filename, { type });
};