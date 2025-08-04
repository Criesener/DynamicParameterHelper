/**
 * E2E tests for XPath generation functionality
 * Tests the complete XML processing and XPath generation workflow
 */

const { test, expect } = require('@playwright/test');

test.describe('XPath Generation Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/demo.html');
    });

    test('should generate XPaths for XML elements', async ({ page }) => {
        // Upload a test XML file
        const xmlContent = `<?xml version="1.0"?>
        <root>
            <person id="1">
                <name>John Doe</name>
                <age>30</age>
                <email>john@example.com</email>
            </person>
            <person id="2">
                <name>Jane Smith</name>
                <age>25</age>
                <email>jane@example.com</email>
            </person>
        </root>`;
        
        // Simulate file upload by directly inputting XML content if possible
        const textInput = page.locator('textarea[placeholder*="XML"], textarea[placeholder*="paste"]');
        if (await textInput.isVisible()) {
            await textInput.fill(xmlContent);
            await page.click('button:has-text("Process"), button:has-text("Generate")');
        }
        
        // Wait for XPath generation
        await page.waitForSelector('.xpath-results, .path-results', { timeout: 5000 });
        
        // Verify XPaths are generated
        const results = page.locator('.xpath-results, .path-results');
        await expect(results).toBeVisible();
        
        // Check for specific XPaths
        await expect(page.locator('text=/root/person')).toBeVisible();
        await expect(page.locator('text=/root/person/name')).toBeVisible();
    });

    test('should handle namespaced XML', async ({ page }) => {
        const namespacedXml = `<?xml version="1.0"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Header>
                <auth:Authentication xmlns:auth="http://example.com/auth">
                    <auth:Token>12345</auth:Token>
                </auth:Authentication>
            </soap:Header>
            <soap:Body>
                <req:Request xmlns:req="http://example.com/request">
                    <req:Data>Test Data</req:Data>
                </req:Request>
            </soap:Body>
        </soap:Envelope>`;
        
        // Process namespaced XML
        const textInput = page.locator('textarea');
        if (await textInput.isVisible()) {
            await textInput.fill(namespacedXml);
            await page.click('button:has-text("Process"), button:has-text("Generate")');
        }
        
        // Wait for results
        await page.waitForSelector('.xpath-results, .namespace-results', { timeout: 5000 });
        
        // Verify namespace handling
        await expect(page.locator('text=soap:')).toBeVisible();
        await expect(page.locator('text=auth:')).toBeVisible();
    });

    test('should allow path selection and copying', async ({ page }) => {
        // Skip if clipboard API not available in test environment
        const clipboardPermission = await page.evaluate(() => {
            return navigator.permissions ? 
                navigator.permissions.query({ name: 'clipboard-write' }).catch(() => null) : 
                null;
        });
        
        if (!clipboardPermission) {
            test.skip('Clipboard API not available in test environment');
        }
        
        // Generate some paths first
        const simpleXml = '<root><item>test</item></root>';
        const textInput = page.locator('textarea');
        if (await textInput.isVisible()) {
            await textInput.fill(simpleXml);
            await page.click('button:has-text("Process")');
        }
        
        await page.waitForSelector('.xpath-results', { timeout: 5000 });
        
        // Select a path
        const pathItem = page.locator('.path-item').first();
        await pathItem.click();
        
        // Try to copy
        const copyButton = page.locator('button:has-text("Copy")');
        if (await copyButton.isVisible()) {
            await copyButton.click();
            
            // Verify copy success indicator
            await expect(page.locator('.copy-success, .copied-indicator')).toBeVisible();
        }
    });
});

test.describe('JSONPath Generation', () => {
    test('should generate JSONPaths for JSON data', async ({ page }) => {
        await page.goto('/demo.html');
        
        const jsonData = `{
            "users": [
                {
                    "id": 1,
                    "name": "John Doe",
                    "profile": {
                        "email": "john@example.com",
                        "preferences": {
                            "theme": "dark",
                            "notifications": true
                        }
                    }
                },
                {
                    "id": 2,
                    "name": "Jane Smith",
                    "profile": {
                        "email": "jane@example.com",
                        "preferences": {
                            "theme": "light",
                            "notifications": false
                        }
                    }
                }
            ]
        }`;
        
        // Process JSON data
        const textInput = page.locator('textarea');
        if (await textInput.isVisible()) {
            await textInput.fill(jsonData);
            await page.click('button:has-text("Process")');
        }
        
        await page.waitForSelector('.jsonpath-results, .path-results', { timeout: 5000 });
        
        // Verify JSONPaths
        await expect(page.locator('text=$.users')).toBeVisible();
        await expect(page.locator('text=$.users[0].name')).toBeVisible();
        await expect(page.locator('text=$.users[*].profile.email')).toBeVisible();
    });
});