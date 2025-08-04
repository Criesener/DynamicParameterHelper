/**
 * Main entry point for DynamicParameterHelper
 * Bundles all modules for single-file distribution
 */

// Import all modules
import { DocumentParser, DocumentParserError } from './DocumentParser.js';
import { PathExtractor } from './PathExtractor.js';
import { NamespaceHandler } from './NamespaceHandler.js';
import { OutputFormatter } from './OutputFormatter.js';
import { TreeDataTransformer } from './TreeDataTransformer.js';
import { VirtualizedTreeView } from './VirtualizedTreeView.js';
import { SelectionStateManager } from './SelectionStateManager.js';
import { InteractiveTreeView } from './InteractiveTreeView.js';
import { FileHandler } from './FileHandler.js';

// Make all classes available globally for the demo HTML
window.DocumentParser = DocumentParser;
window.DocumentParserError = DocumentParserError;
window.PathExtractor = PathExtractor;
window.NamespaceHandler = NamespaceHandler;
window.OutputFormatter = OutputFormatter;
window.TreeDataTransformer = TreeDataTransformer;
window.VirtualizedTreeView = VirtualizedTreeView;
window.SelectionStateManager = SelectionStateManager;
window.InteractiveTreeView = InteractiveTreeView;
window.FileHandler = FileHandler;

// Export for module usage
export {
  DocumentParser,
  DocumentParserError,
  PathExtractor,
  NamespaceHandler,
  OutputFormatter,
  TreeDataTransformer,
  VirtualizedTreeView,
  SelectionStateManager,
  InteractiveTreeView,
  FileHandler
};

// Bundle metadata
export const BUILD_INFO = {
  version: '1.0.0',
  buildDate: new Date().toISOString(),
  bundler: 'rollup',
  modules: [
    'DocumentParser',
    'PathExtractor', 
    'NamespaceHandler',
    'OutputFormatter',
    'TreeDataTransformer',
    'VirtualizedTreeView',
    'SelectionStateManager',
    'InteractiveTreeView',
    'FileHandler'
  ]
};

// Add build info to global scope
window.DYNAMIC_PARAMETER_HELPER_BUILD_INFO = BUILD_INFO;