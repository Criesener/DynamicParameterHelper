/**
 * TreeDataTransformer - Converts flat XPath/JSONPath arrays into hierarchical tree structures
 * Optimized for performance with large datasets (10k+ paths) and virtual scrolling support
 * 
 * Features:
 * - Transform flat paths to hierarchical TreeNode structure
 * - Handle both XPath and JSONPath formats
 * - Support for flattening tree for virtual scrolling
 * - Preserve original path metadata and types
 * - Efficient parent-child relationship mapping
 */
class TreeDataTransformer {
    constructor(options = {}) {
        this.nodeIdCounter = 0;
        this.nodeMap = new Map(); // ID -> TreeNode mapping for fast lookups
        this.pathToNodeMap = new Map(); // Path -> TreeNode for deduplication
    }

    /**
     * Transform flat path array to hierarchical tree structure
     * @param {Array} paths - Array of path objects from PathExtractor
     * @param {string} documentFormat - 'xml' or 'json'
     * @returns {TreeNode} Root tree node
     */
    transformPathsToTree(paths, documentFormat) {
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            throw new TreeDataTransformerError('Invalid paths array provided', 'ValidationError');
        }

        // Reset state for new transformation
        this.reset();

        // Create virtual root node
        const rootNode = this.createTreeNode('$root', null, {
            type: 'root',
            displayName: documentFormat === 'xml' ? 'XML Document' : 'JSON Document',
            isRoot: true
        });

        // Group paths by their hierarchical structure
        const pathGroups = this.groupPathsByHierarchy(paths, documentFormat);

        // Build tree structure
        this.buildTreeFromGroups(rootNode, pathGroups, documentFormat);

        return rootNode;
    }

    /**
     * Flatten tree structure for virtual scrolling
     * @param {TreeNode} rootNode - Root node of the tree
     * @param {boolean} respectExpansion - Only include visible (expanded) nodes
     * @returns {Array} Flat array of TreeNode objects in display order
     */
    flattenTreeForDisplay(rootNode, respectExpansion = true) {
        const flattenedNodes = [];
        
        const traverse = (node, level = 0) => {
            if (!node) return;

            // Add current node (skip virtual root)
            if (!node.metadata.isRoot) {
                flattenedNodes.push({
                    ...node,
                    level: level,
                    displayIndex: flattenedNodes.length
                });
            }

            // Add children if expanded or expansion is ignored
            if (!respectExpansion || node.expanded || node.metadata.isRoot) {
                const childLevel = node.metadata.isRoot ? 0 : level + 1;
                for (const child of node.children.values()) {
                    traverse(child, childLevel);
                }
            }
        };

        traverse(rootNode);
        return flattenedNodes;
    }

    /**
     * Create a new TreeNode with unique ID
     * @param {string} path - Full path (XPath or JSONPath)
     * @param {any} originalData - Original data from PathExtractor
     * @param {Object} metadata - Additional metadata
     * @returns {TreeNode}
     */
    createTreeNode(path, originalData, metadata = {}) {
        const node = new TreeNode(
            this.generateNodeId(),
            path,
            originalData,
            {
                ...metadata,
                displayName: metadata.displayName || this.extractDisplayName(path),
                hasChildren: false,
                childCount: 0
            }
        );

        this.nodeMap.set(node.id, node);
        this.pathToNodeMap.set(path, node);
        
        return node;
    }

    /**
     * Group paths by their hierarchical relationships
     * @private
     */
    groupPathsByHierarchy(paths, documentFormat) {
        const groups = new Map();

        for (const pathInfo of paths) {
            const pathSegments = this.parsePathSegments(pathInfo.path, documentFormat);
            const parentPath = this.buildParentPath(pathSegments, documentFormat);
            
            if (!groups.has(parentPath)) {
                groups.set(parentPath, []);
            }
            
            groups.get(parentPath).push({
                ...pathInfo,
                segments: pathSegments,
                parentPath: parentPath
            });
        }

        return groups;
    }

    /**
     * Build tree structure from grouped paths
     * @private
     */
    buildTreeFromGroups(rootNode, pathGroups, documentFormat) {
        // Sort groups by path depth to ensure parents are created before children
        const sortedGroups = Array.from(pathGroups.entries())
            .sort(([pathA], [pathB]) => {
                const depthA = this.calculatePathDepth(pathA, documentFormat);
                const depthB = this.calculatePathDepth(pathB, documentFormat);
                return depthA - depthB;
            });

        for (const [parentPath, pathInfos] of sortedGroups) {
            const parentNode = this.findOrCreateParentNode(parentPath, rootNode, documentFormat);
            
            for (const pathInfo of pathInfos) {
                this.addChildToParent(parentNode, pathInfo, documentFormat);
            }
        }

        // Update hasChildren flags and child counts
        this.updateTreeMetadata(rootNode);
    }

    /**
     * Find or create parent node in the tree
     * @private
     */
    findOrCreateParentNode(parentPath, rootNode, documentFormat) {
        if (!parentPath || parentPath === '$root') {
            return rootNode;
        }

        // Check if node already exists
        if (this.pathToNodeMap.has(parentPath)) {
            return this.pathToNodeMap.get(parentPath);
        }

        // Create intermediate parent nodes if needed
        const segments = this.parsePathSegments(parentPath, documentFormat);
        let currentNode = rootNode;
        let currentPath = documentFormat === 'xml' ? '' : '$';

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const segmentPath = this.buildPathFromSegments(segments.slice(0, i + 1), documentFormat);
            
            if (this.pathToNodeMap.has(segmentPath)) {
                currentNode = this.pathToNodeMap.get(segmentPath);
            } else {
                // Create intermediate node
                const intermediateNode = this.createTreeNode(segmentPath, null, {
                    type: 'intermediate',
                    displayName: segment,
                    isIntermediate: true
                });
                
                currentNode.addChild(intermediateNode);
                currentNode = intermediateNode;
            }
        }

        return currentNode;
    }

    /**
     * Add child node to parent
     * @private
     */
    addChildToParent(parentNode, pathInfo, documentFormat) {
        const existingNode = this.pathToNodeMap.get(pathInfo.path);
        
        if (existingNode) {
            // Update existing node with more specific data
            existingNode.originalData = pathInfo;
            existingNode.metadata = {
                ...existingNode.metadata,
                type: pathInfo.type || 'element',
                value: pathInfo.value,
                namespaceURI: pathInfo.namespaceURI
            };
        } else {
            // Create new child node
            const childNode = this.createTreeNode(pathInfo.path, pathInfo, {
                type: pathInfo.type || 'element',
                displayName: this.extractDisplayName(pathInfo.path),
                value: pathInfo.value,
                namespaceURI: pathInfo.namespaceURI
            });
            
            parentNode.addChild(childNode);
        }
    }

    /**
     * Parse path into segments based on format
     * @private
     */
    parsePathSegments(path, documentFormat) {
        if (documentFormat === 'xml') {
            return this.parseXPathSegments(path);
        } else {
            return this.parseJSONPathSegments(path);
        }
    }

    /**
     * Parse XPath into segments
     * @private
     */
    parseXPathSegments(xpath) {
        if (!xpath || xpath === '/') return [];
        
        // Remove leading slash and split by /
        const segments = xpath.replace(/^\/+/, '').split('/').filter(s => s);
        
        // Clean up segments (remove indices for grouping)
        return segments.map(segment => {
            // Remove [index] notation for element names
            const match = segment.match(/^(.+?)\[\d+\]$/);
            return match ? match[1] : segment;
        });
    }

    /**
     * Parse JSONPath into segments
     * @private
     */
    parseJSONPathSegments(jsonPath) {
        if (!jsonPath || jsonPath === '$') return [];
        
        // Handle different JSONPath notations
        const segments = [];
        let current = jsonPath.replace(/^\$\.?/, ''); // Remove root indicator
        
        // Split by . and handle bracket notation
        const parts = current.split(/\.|\[|\]/);
        
        for (const part of parts) {
            if (part && part !== "'" && part !== '"') {
                // Clean quotes from bracket notation
                const cleaned = part.replace(/^['"]|['"]$/g, '');
                if (cleaned) {
                    segments.push(cleaned);
                }
            }
        }
        
        return segments;
    }

    /**
     * Build parent path from segments
     * @private
     */
    buildParentPath(segments, documentFormat) {
        if (segments.length <= 1) {
            return '$root';
        }
        
        const parentSegments = segments.slice(0, -1);
        return this.buildPathFromSegments(parentSegments, documentFormat);
    }

    /**
     * Build path from segments array
     * @private
     */
    buildPathFromSegments(segments, documentFormat) {
        if (segments.length === 0) {
            return '$root';
        }
        
        if (documentFormat === 'xml') {
            return '/' + segments.join('/');
        } else {
            return '$.' + segments.join('.');
        }
    }

    /**
     * Calculate path depth
     * @private
     */
    calculatePathDepth(path, documentFormat) {
        if (!path || path === '$root') return 0;
        return this.parsePathSegments(path, documentFormat).length;
    }

    /**
     * Extract display name from path
     * @private
     */
    extractDisplayName(path) {
        if (!path) return 'Unknown';
        
        if (path.includes('/')) {
            // XPath - get last segment
            const segments = path.split('/').filter(s => s);
            const lastSegment = segments[segments.length - 1];
            
            // Handle attributes and text nodes
            if (lastSegment.startsWith('@')) {
                return lastSegment; // Keep @ for attributes
            }
            if (lastSegment === 'text()') {
                return 'text()';
            }
            
            // Remove index notation for display
            const match = lastSegment.match(/^(.+?)\[\d+\]$/);
            return match ? match[1] : lastSegment;
        } else {
            // JSONPath - get last segment
            const segments = path.split(/[.\[\]'"]/).filter(s => s && s !== '$');
            return segments[segments.length - 1] || 'root';
        }
    }

    /**
     * Update tree metadata (hasChildren, childCount)
     * @private
     */
    updateTreeMetadata(node) {
        if (!node) return;
        
        const childCount = node.children.size;
        node.metadata.hasChildren = childCount > 0;
        node.metadata.childCount = childCount;
        
        // Recursively update children
        for (const child of node.children.values()) {
            this.updateTreeMetadata(child);
        }
    }

    /**
     * Generate unique node ID
     * @private
     */
    generateNodeId() {
        return `node_${this.nodeIdCounter++}`;
    }

    /**
     * Reset transformer state
     */
    reset() {
        this.nodeIdCounter = 0;
        this.nodeMap.clear();
        this.pathToNodeMap.clear();
    }

    /**
     * Get transformer statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            nodeCount: this.nodeMap.size,
            pathCount: this.pathToNodeMap.size,
            nextNodeId: this.nodeIdCounter
        };
    }
}

/**
 * TreeNode - Represents a single node in the hierarchical tree structure
 * Manages selection state, expansion state, and parent-child relationships
 */
class TreeNode {
    constructor(id, path, originalData, metadata = {}) {
        this.id = id;
        this.path = path;
        this.originalData = originalData;
        this.metadata = metadata;
        
        // Tree structure
        this.parent = null;
        this.children = new Map(); // key -> TreeNode
        
        // Selection state
        this.selected = false;
        this.indeterminate = false;
        
        // UI state
        this.expanded = false;
        this.visible = true;
        this.highlighted = false;
        
        // Display properties
        this.level = 0;
        this.displayIndex = -1;
    }

    /**
     * Add child node
     * @param {TreeNode} childNode - Child to add
     */
    addChild(childNode) {
        if (!childNode || !childNode.id) {
            throw new Error('Invalid child node');
        }
        
        childNode.parent = this;
        this.children.set(childNode.id, childNode);
        
        // Update metadata
        this.metadata.hasChildren = true;
        this.metadata.childCount = this.children.size;
    }

    /**
     * Remove child node
     * @param {string} childId - ID of child to remove
     */
    removeChild(childId) {
        const child = this.children.get(childId);
        if (child) {
            child.parent = null;
            this.children.delete(childId);
            
            // Update metadata
            this.metadata.hasChildren = this.children.size > 0;
            this.metadata.childCount = this.children.size;
        }
    }

    /**
     * Get all descendant nodes
     * @returns {Array<TreeNode>} All descendants
     */
    getAllDescendants() {
        const descendants = [];
        
        const traverse = (node) => {
            for (const child of node.children.values()) {
                descendants.push(child);
                traverse(child);
            }
        };
        
        traverse(this);
        return descendants;
    }

    /**
     * Get path to root
     * @returns {Array<TreeNode>} Path from this node to root
     */
    getPathToRoot() {
        const path = [];
        let current = this;
        
        while (current) {
            path.unshift(current);
            current = current.parent;
        }
        
        return path;
    }

    /**
     * Check if node is ancestor of another node
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if this node is ancestor
     */
    isAncestorOf(node) {
        let current = node.parent;
        
        while (current) {
            if (current === this) {
                return true;
            }
            current = current.parent;
        }
        
        return false;
    }

    /**
     * Get display name with type indicator
     * @returns {string} Display name
     */
    getDisplayName() {
        const baseName = this.metadata.displayName || 'Unknown';
        
        // Add type indicators
        switch (this.metadata.type) {
            case 'attribute':
                return baseName; // Already has @ prefix
            case 'text':
                return 'text()';
            case 'array':
                return `${baseName} []`;
            case 'object':
                return `${baseName} {}`;
            default:
                return baseName;
        }
    }

    /**
     * Check if node matches search criteria
     * @param {string} searchTerm - Search term
     * @returns {boolean} True if matches
     */
    matchesSearch(searchTerm) {
        if (!searchTerm) return true;
        
        const term = searchTerm.toLowerCase();
        const displayName = this.getDisplayName().toLowerCase();
        const path = this.path.toLowerCase();
        
        return displayName.includes(term) || path.includes(term);
    }

    /**
     * Clone node (shallow copy)
     * @returns {TreeNode} Cloned node
     */
    clone() {
        const cloned = new TreeNode(
            this.id,
            this.path,
            this.originalData,
            { ...this.metadata }
        );
        
        cloned.selected = this.selected;
        cloned.indeterminate = this.indeterminate;
        cloned.expanded = this.expanded;
        cloned.visible = this.visible;
        cloned.highlighted = this.highlighted;
        cloned.level = this.level;
        cloned.displayIndex = this.displayIndex;
        
        return cloned;
    }
}

/**
 * Custom error class for TreeDataTransformer errors
 */
class TreeDataTransformerError extends Error {
    constructor(message, type = 'TransformError', context = {}) {
        super(message);
        this.name = 'TreeDataTransformerError';
        this.type = type;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TreeDataTransformerError);
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TreeDataTransformer, TreeNode, TreeDataTransformerError };
} else if (typeof window !== 'undefined') {
    window.TreeDataTransformer = TreeDataTransformer;
    window.TreeNode = TreeNode;
    window.TreeDataTransformerError = TreeDataTransformerError;
}