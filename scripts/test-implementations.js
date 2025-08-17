#!/usr/bin/env node

/**
 * Comprehensive Testing Script for Loop Social Platform
 * Tests all major implementations and features
 */

const fs = require('fs');
const path = require('path');

class ImplementationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0
    };
    this.tests = [];
    this.projectRoot = process.cwd();
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  addTest(name, status, message = '') {
    this.tests.push({ name, status, message });
    if (status === 'pass') this.results.passed++;
    else if (status === 'fail') this.results.failed++;
    else if (status === 'warning') this.results.warnings++;
  }

  fileExists(filePath) {
    return fs.existsSync(path.join(this.projectRoot, filePath));
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(this.projectRoot, filePath), 'utf8');
    } catch (error) {
      return null;
    }
  }

  checkFileContent(filePath, patterns, testName) {
    const content = this.readFile(filePath);
    if (!content) {
      this.addTest(testName, 'fail', `File ${filePath} not found`);
      return false;
    }

    const missingPatterns = patterns.filter(pattern => {
      if (typeof pattern === 'string') {
        return !content.includes(pattern);
      } else if (pattern instanceof RegExp) {
        return !pattern.test(content);
      }
      return false;
    });

    if (missingPatterns.length === 0) {
      this.addTest(testName, 'pass');
      return true;
    } else {
      this.addTest(testName, 'fail', `Missing patterns: ${missingPatterns.join(', ')}`);
      return false;
    }
  }

  testDatabaseSchemas() {
    this.log('\n🗄️  Testing Database Schemas...', 'info');

    const schemaFiles = [
      'scripts/enhanced-database-schema.sql',
      'scripts/enhanced-database-schema-part2.sql',
      'scripts/enhanced-database-schema-part3.sql',
      'scripts/rls-policies.sql',
      'scripts/enhanced-database-functions.sql',
      'scripts/trending-hashtags-function.sql'
    ];

    schemaFiles.forEach(file => {
      if (this.fileExists(file)) {
        this.addTest(`Database Schema: ${file}`, 'pass');
      } else {
        this.addTest(`Database Schema: ${file}`, 'fail', 'File missing');
      }
    });

    // Check for specific database features
    this.checkFileContent(
      'scripts/enhanced-database-schema.sql',
      ['CREATE TABLE', 'profiles', 'loops', 'comments'],
      'Core Database Tables'
    );

    this.checkFileContent(
      'scripts/rls-policies.sql',
      ['ROW LEVEL SECURITY', 'CREATE POLICY'],
      'Row Level Security Policies'
    );
  }

  testAPIRoutes() {
    this.log('\n🔌 Testing API Routes...', 'info');

    const apiRoutes = [
      'app/api/admin/verification/route.ts',
      'app/api/admin/premium/route.ts',
      'app/api/verification/request/route.ts',
      'app/api/premium/request/route.ts',
      'app/api/support/messages/route.ts',
      'app/api/developers/projects/route.ts',
      'app/api/invitations/route.ts',
      'app/api/streams/notifications/route.ts',
      'app/api/explore/trending/route.ts'
    ];

    apiRoutes.forEach(route => {
      if (this.fileExists(route)) {
        this.addTest(`API Route: ${route}`, 'pass');
      } else {
        this.addTest(`API Route: ${route}`, 'fail', 'Route file missing');
      }
    });

    // Check for proper API structure
    this.checkFileContent(
      'app/api/admin/verification/route.ts',
      ['export async function GET', 'export async function POST', 'NextResponse'],
      'Admin Verification API Structure'
    );
  }

  testComponents() {
    this.log('\n🧩 Testing Components...', 'info');

    const components = [
      'components/admin/admin-dashboard.tsx',
      'components/verification/verification-request.tsx',
      'components/premium/premium-upgrade.tsx',
      'components/games/mini-games.tsx',
      'components/invitations/invite-modal.tsx',
      'components/notifications/live-stream-notifications.tsx',
      'components/developers/developers-content.tsx'
    ];

    components.forEach(component => {
      if (this.fileExists(component)) {
        this.addTest(`Component: ${component}`, 'pass');
      } else {
        this.addTest(`Component: ${component}`, 'fail', 'Component file missing');
      }
    });

    // Check for React component structure
    this.checkFileContent(
      'components/admin/admin-dashboard.tsx',
      ['"use client"', 'export function', 'useState', 'useEffect'],
      'Admin Dashboard Component Structure'
    );
  }

  testResponsiveDesign() {
    this.log('\n📱 Testing Responsive Design...', 'info');

    // Check responsive CSS
    if (this.fileExists('styles/responsive.css')) {
      this.addTest('Responsive CSS File', 'pass');
    } else {
      this.addTest('Responsive CSS File', 'fail', 'Responsive CSS missing');
    }

    // Check responsive hooks
    if (this.fileExists('hooks/use-responsive.ts')) {
      this.addTest('Responsive Hooks', 'pass');
    } else {
      this.addTest('Responsive Hooks', 'fail', 'Responsive hooks missing');
    }

    // Check responsive components
    if (this.fileExists('components/responsive/responsive-wrapper.tsx')) {
      this.addTest('Responsive Components', 'pass');
    } else {
      this.addTest('Responsive Components', 'fail', 'Responsive components missing');
    }

    // Check Tailwind config for responsive breakpoints
    this.checkFileContent(
      'tailwind.config.ts',
      ['screens', 'xs', 'sm', 'md', 'lg', 'xl'],
      'Tailwind Responsive Breakpoints'
    );

    // Check layout includes responsive CSS
    this.checkFileContent(
      'app/layout.tsx',
      ['responsive.css'],
      'Layout Includes Responsive CSS'
    );
  }

  testRealTimeFeatures() {
    this.log('\n⚡ Testing Real-time Features...', 'info');

    // Check explore content real-time
    this.checkFileContent(
      'components/explore/explore-content.tsx',
      ['channel(', 'postgres_changes', 'subscribe()'],
      'Explore Real-time Subscriptions'
    );

    // Check support chat real-time
    if (this.fileExists('app/support/chat/page.tsx')) {
      this.checkFileContent(
        'app/support/chat/page.tsx',
        ['useEffect', 'setInterval', 'fetchMessages'],
        'Support Chat Real-time'
      );
    }

    // Check live stream notifications
    this.checkFileContent(
      'components/notifications/live-stream-notifications.tsx',
      ['useState', 'useEffect', 'notification'],
      'Live Stream Notifications'
    );
  }

  testErrorHandling() {
    this.log('\n🛡️  Testing Error Handling...', 'info');

    // Check error boundary
    if (this.fileExists('components/error-boundary.tsx')) {
      this.addTest('Error Boundary Component', 'pass');
    } else {
      this.addTest('Error Boundary Component', 'fail', 'Error boundary missing');
    }

    // Check loading states
    if (this.fileExists('components/loading-states.tsx')) {
      this.addTest('Loading States Component', 'pass');
    } else {
      this.addTest('Loading States Component', 'fail', 'Loading states missing');
    }

    // Check API error handling patterns
    const apiFiles = [
      'app/api/admin/verification/route.ts',
      'app/api/support/messages/route.ts'
    ];

    apiFiles.forEach(file => {
      this.checkFileContent(
        file,
        ['try', 'catch', 'NextResponse.json', 'status: 500'],
        `Error Handling in ${file}`
      );
    });
  }

  testSecurity() {
    this.log('\n🔒 Testing Security Features...', 'info');

    // Check RLS policies exist
    if (this.fileExists('scripts/rls-policies.sql')) {
      this.addTest('Row Level Security Policies', 'pass');
    } else {
      this.addTest('Row Level Security Policies', 'fail', 'RLS policies missing');
    }

    // Check authentication usage
    const authFiles = [
      'app/api/admin/verification/route.ts',
      'components/admin/admin-dashboard.tsx'
    ];

    authFiles.forEach(file => {
      this.checkFileContent(
        file,
        ['auth', 'user'],
        `Authentication in ${file}`
      );
    });
  }

  testConfiguration() {
    this.log('\n⚙️  Testing Configuration...', 'info');

    const configFiles = [
      'tailwind.config.ts',
      'next.config.js',
      'package.json'
    ];

    configFiles.forEach(file => {
      if (this.fileExists(file)) {
        this.addTest(`Config File: ${file}`, 'pass');
      } else {
        this.addTest(`Config File: ${file}`, 'warning', 'Config file missing');
      }
    });

    // Check package.json for required dependencies
    const packageJson = this.readFile('package.json');
    if (packageJson) {
      const pkg = JSON.parse(packageJson);
      const requiredDeps = [
        '@supabase/supabase-js',
        'next',
        'react',
        'tailwindcss'
      ];

      requiredDeps.forEach(dep => {
        if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
          this.addTest(`Dependency: ${dep}`, 'pass');
        } else {
          this.addTest(`Dependency: ${dep}`, 'warning', 'Dependency missing');
        }
      });
    }
  }

  testDocumentation() {
    this.log('\n📚 Testing Documentation...', 'info');

    const docFiles = [
      'README.md',
      'docs/API_DOCUMENTATION.md'
    ];

    docFiles.forEach(file => {
      if (this.fileExists(file)) {
        this.addTest(`Documentation: ${file}`, 'pass');
      } else {
        this.addTest(`Documentation: ${file}`, 'warning', 'Documentation missing');
      }
    });
  }

  generateReport() {
    this.log('\n📊 Test Results Summary', 'info');
    this.log('='.repeat(50), 'info');
    
    this.log(`✅ Passed: ${this.results.passed}`, 'success');
    this.log(`❌ Failed: ${this.results.failed}`, 'error');
    this.log(`⚠️  Warnings: ${this.results.warnings}`, 'warning');
    
    const total = this.results.passed + this.results.failed + this.results.warnings;
    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : '0.0';
    
    this.log(`\n📈 Success Rate: ${successRate}%`, 'info');

    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:', 'error');
      this.tests
        .filter(test => test.status === 'fail')
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.message}`, 'error');
        });
    }

    if (this.results.warnings > 0) {
      this.log('\n⚠️  Warnings:', 'warning');
      this.tests
        .filter(test => test.status === 'warning')
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.message}`, 'warning');
        });
    }

    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      tests: this.tests,
      successRate: parseFloat(successRate)
    };

    fs.writeFileSync(
      path.join(this.projectRoot, 'test-report.json'),
      JSON.stringify(report, null, 2)
    );

    this.log('\n📄 Detailed report saved to test-report.json', 'info');
  }

  async run() {
    this.log('🚀 Starting Loop Social Platform Implementation Tests...', 'info');
    this.log('='.repeat(60), 'info');

    try {
      this.testDatabaseSchemas();
      this.testAPIRoutes();
      this.testComponents();
      this.testResponsiveDesign();
      this.testRealTimeFeatures();
      this.testErrorHandling();
      this.testSecurity();
      this.testConfiguration();
      this.testDocumentation();

      this.generateReport();

      if (this.results.failed === 0) {
        this.log('\n🎉 All critical tests passed! The implementation looks good.', 'success');
        process.exit(0);
      } else {
        this.log('\n🔧 Some tests failed. Please review and fix the issues above.', 'error');
        process.exit(1);
      }
    } catch (error) {
      this.log(`\n💥 Test runner error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new ImplementationTester();
  tester.run();
}

module.exports = ImplementationTester;
