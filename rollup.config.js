import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import fs from 'fs';
import path from 'path';

// Custom plugin to create single HTML file with inlined JS and CSS
const htmlBundle = () => {
  return {
    name: 'html-bundle',
    generateBundle(options, bundle) {
      // Get the bundled JavaScript
      const jsFile = Object.keys(bundle).find(key => key.endsWith('.js'));
      const jsContent = bundle[jsFile].code;
      
      // Read the template HTML (we'll use tree-view-demo.html as base)
      const templatePath = path.join(process.cwd(), 'tree-view-demo.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf-8');
      
      // Extract existing CSS from the template
      const cssMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
      const existingCss = cssMatch ? cssMatch[1] : '';
      
      // Remove all external script references
      htmlContent = htmlContent.replace(
        /<script\s+src="[^"]+"><\/script>/g, 
        ''
      );
      
      // Find the last script tag before </body> and replace it with our bundle
      const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/);
      if (scriptMatch) {
        const originalScript = scriptMatch[1];
        htmlContent = htmlContent.replace(
          /<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/,
          `<script>
// Bundled JavaScript
${jsContent}

// Original inline script
${originalScript}
</script>`
        );
      } else {
        // If no script found, add before </body>
        htmlContent = htmlContent.replace(
          '</body>',
          `<script>
// Bundled JavaScript
${jsContent}
</script>
</body>`
        );
      }
      
      // Optimize CSS (basic minification)
      const minifiedCss = existingCss
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .trim();
      
      // Replace the style tag with minified CSS
      if (cssMatch) {
        htmlContent = htmlContent.replace(
          /<style>[\s\S]*?<\/style>/,
          `<style>${minifiedCss}</style>`
        );
      }
      
      // Add build metadata
      const buildDate = new Date().toISOString();
      const buildComment = `<!-- 
Built with Rollup on ${buildDate}
Single-file distribution for DynamicParameterHelper
All dependencies bundled and inlined
-->`;
      
      htmlContent = htmlContent.replace(
        '<!DOCTYPE html>',
        `${buildComment}\n<!DOCTYPE html>`
      );
      
      // Create the final HTML file
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: htmlContent
      });
      
      // Remove the JS file from the bundle since it's now inlined
      delete bundle[jsFile];
    }
  };
};

export default [
  // Main build configuration
  {
    input: 'src/main.js', // We'll create this entry point
    output: {
      file: 'dist/bundle.js',
      format: 'iife',
      name: 'DynamicParameterHelper'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      terser({
        compress: {
          drop_console: false, // Keep console for debugging
          drop_debugger: false
        },
        mangle: {
          keep_fnames: true // Keep function names for debugging
        }
      }),
      htmlBundle(),
      copy({
        targets: [
          { src: 'test-sample.json', dest: 'dist' },
          { src: 'test-sample.xml', dest: 'dist' },
          { src: 'README.md', dest: 'dist' }
        ]
      })
    ],
    external: [] // No external dependencies
  },
  
  // Debug build (unminified)
  {
    input: 'src/main.js',
    output: {
      file: 'dist/debug/bundle.js',
      format: 'iife',
      name: 'DynamicParameterHelper'
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      // No terser for debug build
      {
        name: 'html-bundle-debug',
        generateBundle(options, bundle) {
          const jsFile = Object.keys(bundle).find(key => key.endsWith('.js'));
          const jsContent = bundle[jsFile].code;
          
          const templatePath = path.join(process.cwd(), 'tree-view-demo.html');
          let htmlContent = fs.readFileSync(templatePath, 'utf-8');
          
          // For debug build, keep formatting and add debug info
          htmlContent = htmlContent.replace(
            /<script\s+src="[^"]+"><\/script>/g, 
            ''
          );
          
          const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/);
          if (scriptMatch) {
            const originalScript = scriptMatch[1];
            htmlContent = htmlContent.replace(
              /<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/,
              `<script>
// DEBUG BUILD - ${new Date().toISOString()}
// Unminified bundle for development and debugging
${jsContent}

// Original inline script
${originalScript}
</script>`
            );
          } else {
            htmlContent = htmlContent.replace(
              '</body>',
              `<script>
// DEBUG BUILD - ${new Date().toISOString()}
// Unminified bundle for development and debugging
${jsContent}
</script>
</body>`
            );
          }
          
          this.emitFile({
            type: 'asset',
            fileName: 'index-debug.html',
            source: htmlContent
          });
          
          delete bundle[jsFile];
        }
      },
      copy({
        targets: [
          { src: 'test-sample.json', dest: 'dist/debug' },
          { src: 'test-sample.xml', dest: 'dist/debug' }
        ]
      })
    ]
  }
];