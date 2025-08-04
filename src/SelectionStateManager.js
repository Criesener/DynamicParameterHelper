/**
 * SelectionStateManager - Manages tree node selection state with parent-child synchronization
 * Handles complex checkbox interactions, batch updates, and indeterminate states
 * 
 * Features:
 * - Parent-child selection synchronization
 * - Indeterminate state calculation
 * - Batch selection updates for performance
 * - Multi-select with keyboard modifiers
 * - Select all / deselect all operations
 * - Selection event system
 */
class SelectionStateManager {
    constructor(options = {}) {
        this.options = {
            enableParentSync: options.enableParentSync !== false,
            enableChildSync: options.enableChildSync !== false,
            enableBatchUpdates: options.enableBatchUpdates !== false,
            ...options
        };
        
        // State
        this.selectedNodes = new Set();
        this.indeterminateNodes = new Set();
        this.lastSelectedNode = null;
        this.batchInProgress = false;
        this.pendingUpdates = new Map();
        
        // Event system
        this.eventListeners = new Map();
    }

    /**
     * Set selection state for a node
     * @param {TreeNode} node - Node to update
     * @param {boolean} selected - New selection state
     * @param {Object} options - Update options
     */
    setNodeSelection(node, selected, options = {}) {
        if (!node) throw new Error('Node is required');
        
        const updateOptions = {
            cascadeToChildren: options.cascadeToChildren !== false,
            updateParentChain: options.updateParentChain !== false,
            isUserAction: options.isUserAction || false,
            shiftKey: options.shiftKey || false,
            ctrlKey: options.ctrlKey || false,
            ...options
        };
        
        // Handle shift+click range selection
        if (updateOptions.shiftKey && this.lastSelectedNode && updateOptions.isUserAction) {
            this.selectRange(this.lastSelectedNode, node, selected);
            return;
        }
        
        const batch = new SelectionBatch();
        
        // Update the node itself
        this.addToBatch(batch, node, selected, false);
        
        // Handle child synchronization
        if (this.options.enableChildSync && updateOptions.cascadeToChildren) {
            this.cascadeSelectionToChildren(node, selected, batch);
        }
        
        // Handle parent synchronization
        if (this.options.enableParentSync && updateOptions.updateParentChain) {
            this.updateParentChain(node, batch);
        }
        
        // Apply the batch
        this.applyBatch(batch);
        
        // Update last selected for range selection
        if (updateOptions.isUserAction) {
            this.lastSelectedNode = node;
        }
        
        // Emit selection change event
        this.emit('selectionChange', {
            node: node,
            selected: selected,
            selectedCount: this.selectedNodes.size,
            options: updateOptions
        });
    }

    /**
     * Toggle node selection state
     * @param {TreeNode} node - Node to toggle
     * @param {Object} options - Toggle options
     */
    toggleNodeSelection(node, options = {}) {
        const currentlySelected = this.isNodeSelected(node);
        this.setNodeSelection(node, !currentlySelected, options);
    }

    /**
     * Select range of nodes between two nodes
     * @param {TreeNode} startNode - Start of range
     * @param {TreeNode} endNode - End of range
     * @param {boolean} selected - Selection state to apply
     */
    selectRange(startNode, endNode, selected) {
        if (!startNode || !endNode) return;
        
        // Find the range of nodes in flattened tree
        const flattenedNodes = this.getFlattenedNodesFromTree(startNode);
        const startIndex = flattenedNodes.findIndex(n => n.id === startNode.id);
        const endIndex = flattenedNodes.findIndex(n => n.id === endNode.id);
        
        if (startIndex === -1 || endIndex === -1) return;
        
        // Determine range bounds
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        const batch = new SelectionBatch();
        
        // Select/deselect all nodes in range
        for (let i = minIndex; i <= maxIndex; i++) {
            const node = flattenedNodes[i];
            this.addToBatch(batch, node, selected, false);
        }
        
        this.applyBatch(batch);
        
        this.emit('rangeSelection', {
            startNode,
            endNode,
            selected,
            count: maxIndex - minIndex + 1
        });
    }

    /**
     * Select all nodes
     * @param {TreeNode} rootNode - Root node of tree
     */
    selectAll(rootNode) {
        if (!rootNode) return;
        
        const batch = new SelectionBatch();
        const allNodes = this.getAllNodesFromTree(rootNode);
        
        for (const node of allNodes) {
            if (!node.metadata.isRoot) { // Skip virtual root
                this.addToBatch(batch, node, true, false);
            }
        }
        
        this.applyBatch(batch);
        
        this.emit('selectAll', {
            count: allNodes.length - 1 // Exclude root
        });
    }

    /**
     * Deselect all nodes
     */
    deselectAll() {
        const batch = new SelectionBatch();
        
        for (const nodeId of this.selectedNodes) {
            const node = this.getNodeById(nodeId);
            if (node) {
                this.addToBatch(batch, node, false, false);
            }
        }
        
        this.applyBatch(batch);
        
        this.emit('deselectAll');
    }

    /**
     * Get selected nodes
     * @returns {Array<TreeNode>} Array of selected nodes
     */
    getSelectedNodes() {
        const selectedNodes = [];
        
        for (const nodeId of this.selectedNodes) {
            const node = this.getNodeById(nodeId);
            if (node) {
                selectedNodes.push(node);
            }
        }
        
        return selectedNodes;
    }

    /**
     * Get selected node paths
     * @returns {Array<string>} Array of selected node paths
     */
    getSelectedPaths() {
        return this.getSelectedNodes().map(node => node.path);
    }

    /**
     * Check if node is selected
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if selected
     */
    isNodeSelected(node) {
        return this.selectedNodes.has(node.id);
    }

    /**
     * Check if node is indeterminate
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if indeterminate
     */
    isNodeIndeterminate(node) {
        return this.indeterminateNodes.has(node.id);
    }

    /**
     * Get selection statistics
     * @returns {Object} Selection statistics
     */
    getSelectionStats() {
        return {
            selectedCount: this.selectedNodes.size,
            indeterminateCount: this.indeterminateNodes.size,
            lastSelectedNode: this.lastSelectedNode?.id || null
        };
    }

    /**
     * Cascade selection to all children
     * @private
     */
    cascadeSelectionToChildren(node, selected, batch) {
        const descendants = node.getAllDescendants();
        
        for (const descendant of descendants) {
            this.addToBatch(batch, descendant, selected, false);
        }
    }

    /**
     * Update parent chain with proper indeterminate states
     * @private
     */
    updateParentChain(startNode, batch) {
        let currentNode = startNode.parent;
        
        while (currentNode && !currentNode.metadata.isRoot) {
            const childStates = this.calculateChildSelectionStates(currentNode, batch);
            
            if (childStates.allSelected) {
                this.addToBatch(batch, currentNode, true, false);
            } else if (childStates.someSelected) {
                this.addToBatch(batch, currentNode, false, true);
            } else {
                this.addToBatch(batch, currentNode, false, false);
            }
            
            currentNode = currentNode.parent;
        }
    }

    /**
     * Calculate child selection states for a parent node
     * @private
     */
    calculateChildSelectionStates(parentNode, batch = null) {
        const children = Array.from(parentNode.children.values());
        
        if (children.length === 0) {
            return { allSelected: false, someSelected: false, noneSelected: true };
        }
        
        let selectedCount = 0;
        let indeterminateCount = 0;
        
        for (const child of children) {
            // Check if child has pending batch update
            const pendingUpdate = batch?.updates.get(child.id);
            
            const isSelected = pendingUpdate ? 
                pendingUpdate.selected : 
                this.isNodeSelected(child);
                
            const isIndeterminate = pendingUpdate ? 
                pendingUpdate.indeterminate : 
                this.isNodeIndeterminate(child);
            
            if (isSelected) {
                selectedCount++;
            } else if (isIndeterminate) {
                indeterminateCount++;
            }
        }
        
        const allSelected = selectedCount === children.length;
        const someSelected = selectedCount > 0 || indeterminateCount > 0;
        const noneSelected = selectedCount === 0 && indeterminateCount === 0;
        
        return { allSelected, someSelected, noneSelected };
    }

    /**
     * Add update to batch
     * @private
     */
    addToBatch(batch, node, selected, indeterminate) {
        batch.add(node.id, {
            node: node,
            selected: selected,
            indeterminate: indeterminate,
            previousSelected: this.isNodeSelected(node),
            previousIndeterminate: this.isNodeIndeterminate(node)
        });
    }

    /**
     * Apply selection batch atomically
     * @private
     */
    applyBatch(batch) {
        if (batch.updates.size === 0) return;
        
        const changes = [];
        
        // Apply all updates
        for (const [nodeId, update] of batch.updates) {
            const { node, selected, indeterminate, previousSelected, previousIndeterminate } = update;
            
            // Update internal state
            if (selected) {
                this.selectedNodes.add(nodeId);
            } else {
                this.selectedNodes.delete(nodeId);
            }
            
            if (indeterminate) {
                this.indeterminateNodes.add(nodeId);
            } else {
                this.indeterminateNodes.delete(nodeId);
            }
            
            // Update node state
            node.selected = selected;
            node.indeterminate = indeterminate;
            
            // Track changes
            if (selected !== previousSelected || indeterminate !== previousIndeterminate) {
                changes.push({
                    node,
                    selected,
                    indeterminate,
                    previousSelected,
                    previousIndeterminate
                });
            }
        }
        
        // Emit batch change event
        if (changes.length > 0) {
            this.emit('batchChange', {
                changes: changes,
                selectedCount: this.selectedNodes.size
            });
        }
    }

    /**
     * Get flattened nodes from tree (helper method)
     * @private
     */
    getFlattenedNodesFromTree(startNode) {
        // This would typically be provided by the tree view component
        // For now, implement a basic flattening
        const nodes = [];
        const root = this.findRootNode(startNode);
        
        const traverse = (node) => {
            if (!node.metadata.isRoot) {
                nodes.push(node);
            }
            
            for (const child of node.children.values()) {
                traverse(child);
            }
        };
        
        traverse(root);
        return nodes;
    }

    /**
     * Get all nodes from tree
     * @private
     */
    getAllNodesFromTree(rootNode) {
        const nodes = [rootNode];
        const queue = [rootNode];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            for (const child of current.children.values()) {
                nodes.push(child);
                queue.push(child);
            }
        }
        
        return nodes;
    }

    /**
     * Find root node by traversing up
     * @private
     */
    findRootNode(node) {
        let current = node;
        while (current.parent) {
            current = current.parent;
        }
        return current;
    }

    /**
     * Get node by ID (would be provided by tree component)
     * @private
     */
    getNodeById(nodeId) {
        // This would typically be provided by the tree component
        // For now, return null - this method should be overridden
        return null;
    }

    /**
     * Set node lookup function
     * @param {Function} lookupFn - Function that takes nodeId and returns TreeNode
     */
    setNodeLookupFunction(lookupFn) {
        this.getNodeById = lookupFn;
    }

    /**
     * Clear all selections
     */
    clear() {
        this.selectedNodes.clear();
        this.indeterminateNodes.clear();
        this.lastSelectedNode = null;
        
        this.emit('clear');
    }

    /**
     * Export selection state
     * @returns {Object} Serializable selection state
     */
    exportState() {
        return {
            selectedNodeIds: Array.from(this.selectedNodes),
            indeterminateNodeIds: Array.from(this.indeterminateNodes),
            lastSelectedNodeId: this.lastSelectedNode?.id || null
        };
    }

    /**
     * Import selection state
     * @param {Object} state - Previously exported state
     */
    importState(state) {
        this.selectedNodes = new Set(state.selectedNodeIds || []);
        this.indeterminateNodes = new Set(state.indeterminateNodeIds || []);
        this.lastSelectedNode = state.lastSelectedNodeId ? 
            this.getNodeById(state.lastSelectedNodeId) : null;
        
        this.emit('stateImported', state);
    }

    /**
     * Add event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback
     */
    addEventListener(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback to remove
     */
    removeEventListener(eventName, callback) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     * @private
     */
    emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventName} event listener:`, error);
                }
            }
        }
    }

    /**
     * Destroy the selection manager
     */
    destroy() {
        this.clear();
        this.eventListeners.clear();
    }
}

/**
 * SelectionBatch - Represents a batch of selection updates
 * Used for atomic updates to prevent intermediate states
 */
class SelectionBatch {
    constructor() {
        this.updates = new Map(); // nodeId -> update object
    }

    /**
     * Add update to batch
     * @param {string} nodeId - Node ID
     * @param {Object} update - Update object
     */
    add(nodeId, update) {
        this.updates.set(nodeId, update);
    }

    /**
     * Check if batch has updates
     * @returns {boolean} True if has updates
     */
    hasUpdates() {
        return this.updates.size > 0;
    }

    /**
     * Get update count
     * @returns {number} Number of updates
     */
    getUpdateCount() {
        return this.updates.size;
    }

    /**
     * Clear all updates
     */
    clear() {
        this.updates.clear();
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SelectionStateManager, SelectionBatch };
} else if (typeof window !== 'undefined') {
    window.SelectionStateManager = SelectionStateManager;
    window.SelectionBatch = SelectionBatch;
}