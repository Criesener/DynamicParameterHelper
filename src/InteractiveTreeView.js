/**
 * InteractiveTreeView - Main orchestrating component for the tree view UI
 * Combines TreeDataTransformer, VirtualizedTreeView, and SelectionStateManager
 * 
 * Features:
 * - Complete tree view with selection, expansion, and search
 * - Integration with DocumentParser and PathExtractor
 * - SAP CI output format generation
 * - Accessibility support (ARIA, keyboard navigation)
 * - Mobile-responsive touch interactions
 * - Performance optimized for 10k+ nodes
 */
class InteractiveTreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            // Display options
            itemHeight: 28,
            showSearch: true,
            showControls: true,
            showStats: false,
            
            // Behavior options
            enableVirtualScrolling: true,
            enableSelection: true,
            enableExpansion: true,
            enableSearch: true,
            
            // Performance options
            overscan: 5,
            bufferSize: 50,
            maxNodes: 50000,
            
            // Integration options
            includeAttributes: true,
            includeTextNodes: false,
            
            ...options
        };
        
        // Core components
        this.dataTransformer = new TreeDataTransformer();
        this.selectionManager = new SelectionStateManager();
        this.virtualTreeView = null;
        
        // State
        this.rootNode = null;
        this.flattenedNodes = [];
        this.filteredNodes = [];
        this.documentFormat = null;
        this.currentSearchTerm = '';
        this.focusedNodeId = null;
        
        // DOM elements
        this.headerContainer = null;
        this.searchInput = null;
        this.controlsContainer = null;
        this.treeContainer = null;
        this.footerContainer = null;
        this.statsContainer = null;
        
        // Event handlers (bound for cleanup)
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleSearch = this.handleSearch.bind(this);
        
        this.initialize();
    }

    /**
     * Initialize the interactive tree view
     */
    initialize() {
        this.createDOMStructure();
        this.setupComponents();
        this.attachEventListeners();
        this.addStyles();
    }

    /**
     * Create the main DOM structure
     * @private
     */
    createDOMStructure() {
        this.container.innerHTML = '';
        this.container.className = 'interactive-tree-view';
        this.container.setAttribute('role', 'tree');
        this.container.setAttribute('aria-label', 'Document structure tree');
        
        // Header with search and controls
        if (this.options.showSearch || this.options.showControls) {
            this.createHeader();
        }
        
        // Main tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'tree-container';
        this.treeContainer.style.cssText = `
            flex: 1;
            min-height: 0;
            position: relative;
        `;
        this.container.appendChild(this.treeContainer);
        
        // Footer with stats
        if (this.options.showStats) {
            this.createFooter();
        }
        
        // Set container styles
        this.container.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;
    }

    /**
     * Create header with search and controls
     * @private
     */
    createHeader() {
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'tree-header';
        this.headerContainer.style.cssText = `
            padding: 12px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        
        // Search input
        if (this.options.enableSearch) {
            this.createSearchInput();
        }
        
        // Control buttons
        if (this.options.showControls) {
            this.createControlButtons();
        }
        
        this.container.appendChild(this.headerContainer);
    }

    /**
     * Create search input
     * @private
     */
    createSearchInput() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.cssText = `
            position: relative;
            flex: 1;
            min-width: 200px;
        `;
        
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search nodes...';
        this.searchInput.className = 'search-input';
        this.searchInput.setAttribute('aria-label', 'Search tree nodes');
        this.searchInput.style.cssText = `
            width: 100%;
            padding: 8px 32px 8px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
        `;
        
        // Search icon
        const searchIcon = document.createElement('span');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = '🔍';
        searchIcon.style.cssText = `
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            font-size: 16px;
        `;
        
        searchContainer.appendChild(this.searchInput);
        searchContainer.appendChild(searchIcon);
        this.headerContainer.appendChild(searchContainer);
    }

    /**
     * Create control buttons
     * @private
     */
    createControlButtons() {
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'tree-controls';
        this.controlsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;
        
        // Expand All button
        const expandAllBtn = this.createButton('Expand All', '📖', () => {
            this.expandAll();
        });
        
        // Collapse All button
        const collapseAllBtn = this.createButton('Collapse All', '📋', () => {
            this.collapseAll();
        });
        
        // Select All button
        const selectAllBtn = this.createButton('Select All', '☑️', () => {
            this.selectAll();
        });
        
        // Deselect All button
        const deselectAllBtn = this.createButton('Deselect All', '☐', () => {
            this.deselectAll();
        });
        
        this.controlsContainer.appendChild(expandAllBtn);
        this.controlsContainer.appendChild(collapseAllBtn);
        this.controlsContainer.appendChild(selectAllBtn);
        this.controlsContainer.appendChild(deselectAllBtn);
        
        this.headerContainer.appendChild(this.controlsContainer);
    }

    /**
     * Create a button element
     * @private
     */
    createButton(text, icon, onClick) {
        const button = document.createElement('button');
        button.textContent = `${icon} ${text}`;
        button.className = 'tree-control-btn';
        button.title = text;
        button.onclick = onClick;
        button.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.background = '#f0f0f0';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.background = '#fff';
        });
        
        return button;
    }

    /**
     * Create footer with statistics
     * @private
     */
    createFooter() {
        this.footerContainer = document.createElement('div');
        this.footerContainer.className = 'tree-footer';
        this.footerContainer.style.cssText = `
            padding: 8px 12px;
            border-top: 1px solid #eee;
            background: #f8f9fa;
            font-size: 12px;
            color: #666;
        `;
        
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'tree-stats';
        this.footerContainer.appendChild(this.statsContainer);
        
        this.container.appendChild(this.footerContainer);
    }

    /**
     * Setup core components
     * @private
     */
    setupComponents() {
        // Setup selection manager
        this.selectionManager.setNodeLookupFunction((nodeId) => {
            return this.dataTransformer.nodeMap.get(nodeId);
        });
        
        // Setup virtual tree view
        if (this.options.enableVirtualScrolling) {
            this.virtualTreeView = new VirtualizedTreeView(this.treeContainer, {
                itemHeight: this.options.itemHeight,
                overscan: this.options.overscan,
                bufferSize: this.options.bufferSize
            });
        }
    }

    /**
     * Attach event listeners
     * @private
     */
    attachEventListeners() {
        // Tree click events
        this.treeContainer.addEventListener('click', this.boundHandleClick);
        
        // Keyboard events
        this.container.addEventListener('keydown', this.boundHandleKeyDown);
        
        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', this.boundHandleSearch);
        }
        
        // Virtual tree view events
        if (this.virtualTreeView) {
            this.treeContainer.addEventListener('render', (event) => {
                this.updateStats();
            });
        }
        
        // Selection events
        this.selectionManager.addEventListener('selectionChange', (data) => {
            this.onSelectionChange(data);
        });
        
        this.selectionManager.addEventListener('batchChange', (data) => {
            this.onBatchSelectionChange(data);
        });
    }

    /**
     * Load document data into the tree view
     * @param {Object} parsedDocument - Result from DocumentParser.parse()
     * @param {Array} pathData - Result from PathExtractor
     */
    loadDocument(parsedDocument, pathData) {
        if (!parsedDocument || !pathData) {
            throw new Error('Both parsedDocument and pathData are required');
        }
        
        this.documentFormat = parsedDocument.format;
        
        try {
            // Transform paths to tree structure
            this.rootNode = this.dataTransformer.transformPathsToTree(pathData, this.documentFormat);
            
            // Initialize all nodes as collapsed except root
            this.initializeNodeStates(this.rootNode);
            
            // Update displays
            this.updateTreeDisplay();
            this.updateStats();
            
            // Emit load event
            this.emit('documentLoaded', {
                format: this.documentFormat,
                nodeCount: this.dataTransformer.getStats().nodeCount,
                pathCount: pathData.length
            });
            
        } catch (error) {
            console.error('Error loading document:', error);
            this.showError('Failed to load document: ' + error.message);
        }
    }

    /**
     * Initialize node states (expansion, selection)
     * @private
     */
    initializeNodeStates(node, level = 0) {
        if (!node) return;
        
        // Expand first few levels by default
        node.expanded = level < 2;
        node.level = level;
        
        // Recursively initialize children
        for (const child of node.children.values()) {
            this.initializeNodeStates(child, level + 1);
        }
    }

    /**
     * Update tree display
     * @private
     */
    updateTreeDisplay() {
        if (!this.rootNode) return;
        
        // Flatten tree for display
        this.flattenedNodes = this.dataTransformer.flattenTreeForDisplay(this.rootNode, true);
        
        // Apply search filter
        this.applySearchFilter();
        
        // Update virtual tree view
        if (this.virtualTreeView) {
            this.virtualTreeView.setData(this.filteredNodes);
        } else {
            // Fallback to regular rendering for small datasets
            this.renderRegularTree();
        }
    }

    /**
     * Apply search filter to nodes
     * @private
     */
    applySearchFilter() {
        if (!this.currentSearchTerm) {
            this.filteredNodes = this.flattenedNodes;
            return;
        }
        
        const searchTerm = this.currentSearchTerm.toLowerCase();
        this.filteredNodes = this.flattenedNodes.filter(node => {
            const matches = node.matchesSearch(searchTerm);
            node.highlighted = matches;
            return matches;
        });
    }

    /**
     * Handle click events
     * @private
     */
    handleClick(event) {
        const nodeElement = event.target.closest('.tree-node-item');
        if (!nodeElement) return;
        
        const nodeId = nodeElement.getAttribute('data-node-id');
        const node = this.dataTransformer.nodeMap.get(nodeId);
        if (!node) return;
        
        // Handle different click targets
        if (event.target.closest('.tree-node-expander')) {
            this.handleExpanderClick(node, event);
        } else if (event.target.closest('.tree-node-checkbox')) {
            this.handleCheckboxClick(node, event);
        } else {
            this.handleNodeClick(node, event);
        }
    }

    /**
     * Handle expander click
     * @private
     */
    handleExpanderClick(node, event) {
        event.preventDefault();
        
        if (!node.metadata.hasChildren) return;
        
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
        
        this.emit('nodeExpanded', {
            node: node,
            expanded: node.expanded
        });
    }

    /**
     * Handle checkbox click
     * @private
     */
    handleCheckboxClick(node, event) {
        event.preventDefault();
        
        this.selectionManager.toggleNodeSelection(node, {
            isUserAction: true,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey || event.metaKey
        });
    }

    /**
     * Handle node label click
     * @private
     */
    handleNodeClick(node, event) {
        // Focus the node
        this.focusNode(node);
        
        // If not using checkboxes, handle selection here
        if (!this.options.enableSelection) return;
        
        this.selectionManager.toggleNodeSelection(node, {
            isUserAction: true,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey || event.metaKey
        });
    }

    /**
     * Handle keyboard events
     * @private
     */
    handleKeyDown(event) {
        if (!this.focusedNodeId) return;
        
        const focusedNode = this.dataTransformer.nodeMap.get(this.focusedNodeId);
        if (!focusedNode) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.focusNextNode();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.focusPreviousNode();
                break;
                
            case 'ArrowRight':
                event.preventDefault();
                if (focusedNode.metadata.hasChildren && !focusedNode.expanded) {
                    focusedNode.expanded = true;
                    this.updateTreeDisplay();
                } else {
                    this.focusNextNode();
                }
                break;
                
            case 'ArrowLeft':
                event.preventDefault();
                if (focusedNode.metadata.hasChildren && focusedNode.expanded) {
                    focusedNode.expanded = false;
                    this.updateTreeDisplay();
                } else if (focusedNode.parent && !focusedNode.parent.metadata.isRoot) {
                    this.focusNode(focusedNode.parent);
                }
                break;
                
            case ' ':
            case 'Enter':
                event.preventDefault();
                this.selectionManager.toggleNodeSelection(focusedNode, {
                    isUserAction: true
                });
                break;
                
            case 'Home':
                event.preventDefault();
                this.focusFirstNode();
                break;
                
            case 'End':
                event.preventDefault();
                this.focusLastNode();
                break;
        }
    }

    /**
     * Handle search input
     * @private
     */
    handleSearch(event) {
        this.currentSearchTerm = event.target.value;
        this.applySearchFilter();
        
        if (this.virtualTreeView) {
            this.virtualTreeView.setData(this.filteredNodes);
        }
        
        this.updateStats();
        
        this.emit('search', {
            term: this.currentSearchTerm,
            resultCount: this.filteredNodes.length
        });
    }

    /**
     * Focus a specific node
     * @private
     */
    focusNode(node) {
        if (!node) return;
        
        this.focusedNodeId = node.id;
        
        // Scroll to node if using virtual scrolling
        if (this.virtualTreeView) {
            this.virtualTreeView.scrollToNode(node.id);
        }
        
        // Update visual focus
        this.updateFocusDisplay();
        
        this.emit('nodeFocused', { node });
    }

    /**
     * Focus next node
     * @private
     */
    focusNextNode() {
        const currentIndex = this.filteredNodes.findIndex(n => n.id === this.focusedNodeId);
        if (currentIndex < this.filteredNodes.length - 1) {
            this.focusNode(this.filteredNodes[currentIndex + 1]);
        }
    }

    /**
     * Focus previous node
     * @private
     */
    focusPreviousNode() {
        const currentIndex = this.filteredNodes.findIndex(n => n.id === this.focusedNodeId);
        if (currentIndex > 0) {
            this.focusNode(this.filteredNodes[currentIndex - 1]);
        }
    }

    /**
     * Focus first node
     * @private
     */
    focusFirstNode() {
        if (this.filteredNodes.length > 0) {
            this.focusNode(this.filteredNodes[0]);
        }
    }

    /**
     * Focus last node
     * @private
     */
    focusLastNode() {
        if (this.filteredNodes.length > 0) {
            this.focusNode(this.filteredNodes[this.filteredNodes.length - 1]);
        }
    }

    /**
     * Update focus display
     * @private
     */
    updateFocusDisplay() {
        // Remove previous focus
        const prevFocused = this.treeContainer.querySelector('.tree-node-item.focused');
        if (prevFocused) {
            prevFocused.classList.remove('focused');
        }
        
        // Add focus to current node
        const focusedElement = this.treeContainer.querySelector(`[data-node-id="${this.focusedNodeId}"]`);
        if (focusedElement) {
            focusedElement.classList.add('focused');
        }
    }

    /**
     * Expand all nodes
     */
    expandAll() {
        if (!this.rootNode) return;
        
        const expandNode = (node) => {
            if (node.metadata.hasChildren) {
                node.expanded = true;
            }
            for (const child of node.children.values()) {
                expandNode(child);
            }
        };
        
        expandNode(this.rootNode);
        this.updateTreeDisplay();
        
        this.emit('expandAll');
    }

    /**
     * Collapse all nodes
     */
    collapseAll() {
        if (!this.rootNode) return;
        
        const collapseNode = (node) => {
            if (node.metadata.hasChildren && !node.metadata.isRoot) {
                node.expanded = false;
            }
            for (const child of node.children.values()) {
                collapseNode(child);
            }
        };
        
        collapseNode(this.rootNode);
        this.updateTreeDisplay();
        
        this.emit('collapseAll');
    }

    /**
     * Select all nodes
     */
    selectAll() {
        if (!this.rootNode) return;
        
        this.selectionManager.selectAll(this.rootNode);
        this.updateTreeDisplay();
    }

    /**
     * Deselect all nodes
     */
    deselectAll() {
        this.selectionManager.deselectAll();
        this.updateTreeDisplay();
    }

    /**
     * Get selected paths for SAP CI integration using OutputFormatter
     * @returns {Object} SAP CI formatted output
     */
    getSelectedPathsForSAP() {
        if (!this.outputFormatter) {
            // OutputFormatter will be loaded when needed
            console.log('OutputFormatter not initialized');
            return { metadata: { valid: false }, output: '' };
        }
        
        const selectedNodes = this.selectionManager.getSelectedNodes();
        const selectedPaths = selectedNodes.map(node => node.path);
        
        // Get namespace information for XML documents
        let namespaces = new Map();
        if (this.documentFormat === 'xml' && selectedNodes.length > 0) {
            const xmlNode = selectedNodes.find(node => node.originalData && node.originalData.element);
            if (xmlNode && xmlNode.originalData.element.ownerDocument) {
                const pathExtractor = new PathExtractor();
                const namespaceString = pathExtractor.getSAPNamespaceFormat(xmlNode.originalData.element.ownerDocument);
                
                // Parse namespace string back to Map format for OutputFormatter
                if (namespaceString) {
                    const pairs = namespaceString.split(';');
                    for (const pair of pairs) {
                        const [prefix, uri] = pair.split('=');
                        if (prefix && uri) {
                            namespaces.set(uri, prefix);
                        }
                    }
                }
            }
        }
        
        // Use OutputFormatter for proper SAP CI formatting
        const formattedOutput = this.outputFormatter.formatForSAP(selectedPaths, namespaces);
        
        // Return legacy format for backward compatibility
        return {
            DynamicCustomHeader: formattedOutput.DynamicCustomHeader,
            DynamicCustomHeaderXMLNamespace: formattedOutput.DynamicCustomHeaderXMLNamespace,
            selectedCount: selectedPaths.length,
            documentFormat: this.documentFormat
        };
    }

    /**
     * Handle selection change event
     * @private
     */
    onSelectionChange(data) {
        this.updateTreeDisplay();
        this.updateStats();
        
        // Trigger real-time output updates if OutputFormatter is initialized
        if (this.outputFormatter) {
            this.outputFormatter.updateOutputDisplay();
        }
        
        this.emit('selectionChange', data);
    }

    /**
     * Handle batch selection change event
     * @private
     */
    onBatchSelectionChange(data) {
        this.updateTreeDisplay();
        this.updateStats();
        
        // Trigger real-time output updates if OutputFormatter is initialized
        if (this.outputFormatter) {
            this.outputFormatter.updateOutputDisplay();
        }
        
        this.emit('batchSelectionChange', data);
    }

    /**
     * Update statistics display
     * @private
     */
    updateStats() {
        if (!this.statsContainer) return;
        
        const selectionStats = this.selectionManager.getSelectionStats();
        const treeStats = this.dataTransformer.getStats();
        
        const displayedCount = this.currentSearchTerm ? 
            this.filteredNodes.length : 
            this.flattenedNodes.length;
        
        this.statsContainer.innerHTML = `
            Total: ${treeStats.nodeCount} | 
            Displayed: ${displayedCount} | 
            Selected: ${selectionStats.selectedCount}
            ${this.currentSearchTerm ? ` | Search: "${this.currentSearchTerm}"` : ''}
        `;
    }

    /**
     * Show error message
     * @private
     */
    showError(message) {
        this.treeContainer.innerHTML = `
            <div class="tree-error" style="
                padding: 20px;
                text-align: center;
                color: #dc3545;
                font-size: 14px;
            ">
                ❌ ${message}
            </div>
        `;
    }

    /**
     * Render regular tree (fallback for small datasets)
     * @private
     */
    renderRegularTree() {
        // Implementation for non-virtualized rendering
        // This would be used for small datasets or as a fallback
        this.treeContainer.innerHTML = '<div>Regular tree rendering not implemented</div>';
    }

    /**
     * Add CSS styles
     * @private
     */
    addStyles() {
        const styleId = 'interactive-tree-view-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .tree-node-item {
                transition: background-color 0.15s ease;
            }
            
            .tree-node-item:hover {
                background-color: #f5f5f5;
            }
            
            .tree-node-item.selected {
                background-color: #e3f2fd;
            }
            
            .tree-node-item.focused {
                outline: 2px solid #2196f3;
                outline-offset: -2px;
            }
            
            .tree-node-item.highlighted {
                background-color: #fff3cd;
            }
            
            .tree-node-expander {
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 12px;
                margin-right: 4px;
            }
            
            .tree-node-expander.leaf {
                cursor: default;
            }
            
            .tree-node-checkbox {
                margin-right: 8px;
            }
            
            .tree-node-icon {
                margin-right: 6px;
                font-size: 14px;
            }
            
            .tree-node-label {
                flex: 1;
                font-size: 13px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .tree-node-value {
                font-size: 11px;
                color: #666;
                font-style: italic;
                margin-left: 8px;
                max-width: 150px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            @media (max-width: 768px) {
                .tree-header {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .tree-controls {
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .tree-control-btn {
                    font-size: 11px;
                    padding: 4px 8px;
                }
                
                .tree-node-value {
                    display: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Simple event emitter
     * @private
     */
    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.container.dispatchEvent(event);
    }

    /**
     * Destroy the tree view
     */
    destroy() {
        // Remove event listeners
        this.treeContainer.removeEventListener('click', this.boundHandleClick);
        this.container.removeEventListener('keydown', this.boundHandleKeyDown);
        
        if (this.searchInput) {
            this.searchInput.removeEventListener('input', this.boundHandleSearch);
        }
        
        // Destroy components
        if (this.virtualTreeView) {
            this.virtualTreeView.destroy();
        }
        
        this.selectionManager.destroy();
        this.dataTransformer.reset();
        
        // Clear DOM
        this.container.innerHTML = '';
        
        // Clear references
        this.rootNode = null;
        this.flattenedNodes = [];
        this.filteredNodes = [];
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InteractiveTreeView };
} else if (typeof window !== 'undefined') {
    window.InteractiveTreeView = InteractiveTreeView;
}