#!/usr/bin/env node

/**
 * Integration Test Script for BMAD Docs Generator
 * Tests the integration of bmad-core architecture templates
 */

const fs = require('fs');
const path = require('path');

class IntegrationTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    /**
     * Run all integration tests
     */
    async runTests() {
        console.log('🧪 Starting BMAD Docs Generator Integration Tests...\n');

        // Test 1: Check if all required agents exist
        await this.testAgentFiles();

        // Test 2: Check if all required tasks exist
        await this.testTaskFiles();

        // Test 3: Check if all required templates exist
        await this.testTemplateFiles();

        // Test 4: Check if workflow configuration exists
        await this.testWorkflowConfiguration();

        // Test 5: Check if team configuration exists
        await this.testTeamConfiguration();

        // Test 6: Check template conversion capability
        await this.testTemplateConversion();

        // Print results
        this.printResults();
    }

    /**
     * Test if all required agent files exist
     */
    async testAgentFiles() {
        const requiredAgents = [
            'architecture-analyst.md',
            'tech-stack-expert.md',
            'pattern-recognition-expert.md'
        ];

        console.log('📋 Testing Agent Files...');
        
        for (const agent of requiredAgents) {
            const agentPath = path.join(__dirname, 'agents', agent);
            if (fs.existsSync(agentPath)) {
                this.addTestResult('PASS', `Agent file exists: ${agent}`);
            } else {
                this.addTestResult('FAIL', `Agent file missing: ${agent}`);
            }
        }
    }

    /**
     * Test if all required task files exist
     */
    async testTaskFiles() {
        const requiredTasks = [
            'analyze-architecture.md',
            'generate-arch-documentation.md',
            'identify-arch-patterns.md'
        ];

        console.log('📋 Testing Task Files...');
        
        for (const task of requiredTasks) {
            const taskPath = path.join(__dirname, 'tasks', task);
            if (fs.existsSync(taskPath)) {
                this.addTestResult('PASS', `Task file exists: ${task}`);
            } else {
                this.addTestResult('FAIL', `Task file missing: ${task}`);
            }
        }
    }

    /**
     * Test if all required template files exist
     */
    async testTemplateFiles() {
        const requiredTemplates = [
            'greenfield-arch-tmpl.yaml',
            'brownfield-arch-tmpl.yaml',
            'microservices-arch-tmpl.yaml'
        ];

        console.log('📋 Testing Template Files...');
        
        for (const template of requiredTemplates) {
            const templatePath = path.join(__dirname, 'templates', 'architecture-templates', template);
            if (fs.existsSync(templatePath)) {
                this.addTestResult('PASS', `Template file exists: ${template}`);
            } else {
                this.addTestResult('FAIL', `Template file missing: ${template}`);
            }
        }
    }

    /**
     * Test workflow configuration
     */
    async testWorkflowConfiguration() {
        console.log('📋 Testing Workflow Configuration...');
        
        const workflowPath = path.join(__dirname, 'workflows', 'enhanced-docs-generation.yaml');
        
        if (fs.existsSync(workflowPath)) {
            this.addTestResult('PASS', 'Workflow configuration file exists');
        } else {
            this.addTestResult('FAIL', 'Workflow configuration file missing');
        }
    }

    /**
     * Test team configuration
     */
    async testTeamConfiguration() {
        console.log('📋 Testing Team Configuration...');
        
        const teamPath = path.join(__dirname, 'agent-teams', 'enhanced-docs-generation-team.yaml');
        
        if (fs.existsSync(teamPath)) {
            this.addTestResult('PASS', 'Team configuration file exists');
        } else {
            this.addTestResult('FAIL', 'Team configuration file missing');
        }
    }

    /**
     * Test template conversion capability
     */
    async testTemplateConversion() {
        console.log('📋 Testing Template Conversion...');
        
        // Check if template converter exists
        const converterPath = path.join(__dirname, 'utils', 'template-converter.py');
        
        if (fs.existsSync(converterPath)) {
            this.addTestResult('PASS', 'Template converter exists');
            
            // Check if it's a valid Python file
            try {
                const converterContent = fs.readFileSync(converterPath, 'utf8');
                if (converterContent.includes('class TemplateConverter')) {
                    this.addTestResult('PASS', 'Template converter is valid Python class');
                } else {
                    this.addTestResult('FAIL', 'Template converter is not a valid Python class');
                }
            } catch (error) {
                this.addTestResult('FAIL', `Template converter read error: ${error.message}`);
            }
        } else {
            this.addTestResult('FAIL', 'Template converter missing');
        }
    }

    /**
     * Add test result
     */
    addTestResult(status, message) {
        this.testResults.total++;
        
        if (status === 'PASS') {
            this.testResults.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${message}`);
        }
        
        this.testResults.details.push({
            status,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        console.log(`Total Tests: ${this.testResults.total}`);
        console.log(`Passed: ${this.testResults.passed} ✅`);
        console.log(`Failed: ${this.testResults.failed} ❌`);
        console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);

        if (this.testResults.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.details
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(`  - ${result.message}`);
                });
        }

        if (this.testResults.passed === this.testResults.total) {
            console.log('\n🎉 All tests passed! Integration is ready.');
        } else {
            console.log('\n⚠️  Some tests failed. Please fix the issues before proceeding.');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new IntegrationTester();
    tester.runTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = IntegrationTester;
