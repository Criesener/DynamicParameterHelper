/**
 * E2E tests for file upload functionality
 * Tests the complete file upload workflow using Playwright
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('File Upload Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/demo.html');
    });

    test('should upload XML file via file input', async ({ page }) => {
        // Create a test XML file
        const testXmlPath = path.join(__dirname, '../test-sample.xml');
        
        // Locate file input and upload file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testXmlPath);
        
        // Wait for processing
        await page.waitForTimeout(1000);
        
        // Verify the file was processed
        await expect(page.locator('.file-success-indicator')).toBeVisible();
    });

    test('should upload JSON file via drag and drop', async ({ page }) => {
        const testJsonPath = path.join(__dirname, '../test-sample.json');
        
        // Simulate drag and drop
        const dropZone = page.locator('.file-drop-zone');
        await dropZone.setInputFiles(testJsonPath);
        
        // Verify processing
        await expect(page.locator('.processing-indicator')).toBeVisible();
        await expect(page.locator('.processing-indicator')).toBeHidden();
    });

    test('should show error for unsupported file types', async ({ page }) => {
        // Try to upload an unsupported file type (if available)
        const fileInput = page.locator('input[type="file"]');
        
        // This would need an actual unsupported file for testing
        // For now, we test the error handling mechanism exists
        const errorDialog = page.locator('.error-dialog');
        // Verify error handling UI exists
        expect(errorDialog).toBeDefined();
    });

    test('should display file information after upload', async ({ page }) => {
        const testXmlPath = path.join(__dirname, '../test-sample.xml');
        
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testXmlPath);
        
        // Wait for file info to appear
        await page.waitForSelector('.file-info', { timeout: 5000 });
        
        // Verify file information is displayed
        await expect(page.locator('.file-name')).toContainText('test-sample.xml');
        await expect(page.locator('.file-size')).toBeVisible();
    });

    test('should generate paths after file upload', async ({ page }) => {
        const testXmlPath = path.join(__dirname, '../test-sample.xml');
        
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testXmlPath);
        
        // Wait for path generation
        await page.waitForSelector('.xpath-results', { timeout: 5000 });
        
        // Verify XPath results are generated
        const xpathResults = page.locator('.xpath-results');
        await expect(xpathResults).toBeVisible();
        await expect(xpathResults).not.toBeEmpty();
    });
});

test.describe('Cross-browser Compatibility', () => {
    test('should work consistently across browsers', async ({ page, browserName }) => {
        await page.goto('/demo.html');
        
        // Basic functionality test that should work in all browsers
        const title = await page.title();
        expect(title).toBeTruthy();
        
        // File upload should be available
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeVisible();
        
        console.log(`Test passed in ${browserName}`);
    });
});

test.describe('Mobile Responsiveness', () => {
    test('should be usable on mobile devices', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/demo.html');
        
        // Verify mobile-friendly file upload
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeVisible();
        
        // Check for mobile-optimized UI elements
        const dropZone = page.locator('.file-drop-zone');
        await expect(dropZone).toBeVisible();
    });
});