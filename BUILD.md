# Build and Distribution Pipeline

This document describes the build system implemented for DynamicParameterHelper to create single-file distributions as specified in Issue #9.

## Overview

The build system supports two bundlers:
- **Rollup** (Primary): Creates a single HTML file with all dependencies inlined
- **Webpack** (Alternative): Creates separate files with source maps for development

## Build Requirements

- Node.js 16+ 
- npm 8+
- All dependencies are bundled (no external CDNs)
- Total size must be under 500KB
- Maintain debuggability with source maps
- Support both development and production builds

## Available Scripts

### Production Builds
```bash
# Build with Rollup (recommended for distribution)
npm run build:rollup

# Build with Webpack (development/debugging)
npm run build:webpack

# Build with both bundlers
npm run build:all

# Build and analyze bundle sizes
npm run build:analyze
```

### Development Builds
```bash
# Debug build with Rollup (unminified)
npm run build:rollup:debug

# Development build with Webpack
npm run build:webpack:dev

# Webpack with bundle analysis
npm run build:webpack:analyze
```

### Utilities
```bash
# Clean build directories
npm run build:clean

# Serve built files locally
npm run serve:dist      # Rollup build on :8080
npm run serve:webpack   # Webpack build on :8081
```

## Build Outputs

### Rollup Build (`dist/`)
- `index.html` - Single file with everything inlined (~120KB)
- `index-debug.html` - Debug version (unminified)
- `test-sample.json` - Sample JSON file
- `test-sample.xml` - Sample XML file
- `README.md` - Documentation

### Webpack Build (`dist-webpack/`)
- `index.html` - Main HTML file (~21KB)
- `bundle.[hash].js` - Main JavaScript bundle (~120KB)
- `*.js.map` - Source maps for debugging
- `bundle-analysis.html` - Bundle analyzer report

## Configuration Files

### Rollup Configuration (`rollup.config.js`)
- Dual build targets (production + debug)
- Custom HTML inlining plugin
- CSS minification and inlining
- Terser minification with debug preservation
- Performance monitoring

### Webpack Configuration (`webpack.config.js`)
- Production and development modes
- HTML template processing
- CSS extraction and minification
- Bundle splitting disabled for single-file requirement
- Bundle analyzer integration
- Source map generation

## Bundle Analysis

The build system includes comprehensive bundle analysis:

```bash
npm run build:analyze
```

This generates:
- Size breakdown by file type
- Comparison between bundlers
- Performance warnings if over 500KB limit
- JSON report for CI/CD integration

Example output:
```
🔧 DynamicParameterHelper Bundle Analysis
==========================================

📊 Rollup Build Analysis
📄 index.html                      121.37 KB
📦 Total Size: 127.25 KB
✅ Within Limit: YES

🏆 Smallest Build: Rollup (127.25 KB)
```

## Architecture Decisions

### Why Rollup for Primary Build?
1. **Single File Output**: Perfect for the requirement of a single distributable HTML file
2. **Tree Shaking**: Better dead code elimination
3. **Smaller Bundle Size**: ~120KB vs ~400KB for Webpack
4. **Simpler Configuration**: Less complex for this use case

### Why Webpack as Alternative?
1. **Development Experience**: Better debugging with separate files
2. **Ecosystem**: More plugins and tools available
3. **Source Maps**: Better debugging support
4. **Industry Standard**: Familiar to more developers

### Module System
- All modules support both CommonJS and ES modules
- ES modules used for bundling (better tree shaking)
- CommonJS fallback for Node.js environments
- Browser globals for direct HTML usage

## Size Optimization Techniques

1. **CSS Inlining**: All styles embedded in HTML
2. **JavaScript Minification**: Terser with function name preservation
3. **Dead Code Elimination**: Rollup tree shaking
4. **No External Dependencies**: Everything bundled locally
5. **Gzip-friendly**: Repeated patterns compress well

## CI/CD Integration

The build system integrates with GitHub Actions:

- **Test Pipeline**: Run all tests before building
- **Build Validation**: Ensure size limits are met
- **Artifact Upload**: Store build outputs
- **Release Automation**: Create releases on version tags
- **GitHub Pages**: Deploy demo to Pages

### Size Monitoring
The CI pipeline fails if any build exceeds 500KB:
```yaml
- name: Check bundle sizes
  run: |
    if [ $ROLLUP_SIZE -gt 512000 ]; then
      echo "❌ Rollup build exceeds 500KB limit"
      exit 1
    fi
```

## Local Development

### Setup
```bash
npm install
npm run build:all
```

### Testing Builds
```bash
# Build and serve locally
npm run build:rollup
npm run serve:dist

# Open http://localhost:8080
```

### Debugging
For debugging issues:
1. Use `npm run build:rollup:debug` for unminified code
2. Check `dist/debug/index-debug.html`
3. Use browser dev tools with source maps
4. Run `npm run build:webpack:analyze` for bundle analysis

## Performance Characteristics

- **Rollup Build**: Single request, ~120KB transfer
- **Webpack Build**: Multiple requests, better caching
- **Load Time**: <200ms on fast connections
- **Parse Time**: <50ms for JavaScript execution
- **Memory Usage**: <10MB heap size

## Maintenance

### Adding New Modules
1. Add ES module exports to new files
2. Import in `src/main.js`
3. Add to global window object if needed
4. Test with both bundlers

### Upgrading Dependencies
1. Test bundle size impact
2. Verify no breaking changes
3. Update version in build metadata
4. Run full test suite

### Troubleshooting

Common issues:
- **Module not found**: Check ES module exports
- **Size limit exceeded**: Run bundle analysis
- **Build fails**: Check for syntax errors in modules
- **Runtime errors**: Test with debug build first

## Future Enhancements

Planned improvements:
- [ ] Brotli compression analysis
- [ ] Progressive web app features
- [ ] Service worker for offline usage
- [ ] Module federation for micro-frontends
- [ ] Advanced tree shaking optimization