/**
 * @jest-environment jsdom
 */

/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EntityWso2AboutCard } from './EntityWso2AboutCard';

// Scope variable to dynamically control entity properties in test cases
let mockEntity: any;

// Mock @backstage/plugin-catalog-react directly to avoid loading ESM dependencies like react-use
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: mockEntity,
  }),
  entityRouteRef: {
    id: 'catalog:entity',
  },
}));

// Mock @backstage/core-plugin-api directly to be fully sandboxed
jest.mock('@backstage/core-plugin-api', () => ({
  useRouteRef: () => (params: any) => `/catalog/${params.namespace}/${params.kind}/${params.name}`,
}));

// Mock @backstage/plugin-catalog and @backstage/core-components to avoid ESM transpilation failures with transitive dependencies like react-syntax-highlighter
jest.mock('@backstage/plugin-catalog', () => ({
  AboutField: (props: any) => (
    <div data-testid={`about-field-${props.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className="label">{props.label}</span>
      <span className="value">{props.value}</span>
    </div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: (props: any) => (
    <div data-testid="info-card">
      {props.subheader}
      {props.children}
    </div>
  ),
  HeaderIconLinkRow: (props: any) => (
    <div data-testid="header-icon-links">
      {props.links?.map((link: any, idx: number) => (
        <a key={idx} href={link.href}>{link.label}</a>
      ))}
    </div>
  ),
}));

describe('EntityWso2AboutCard', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  beforeEach(() => {
    mockEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: 'test-api',
        title: 'Test API Title',
        description: 'This is a test WSO2 API description.',
        annotations: {
          'wso2.com/api-lifecycle-status': 'PUBLISHED',
          'wso2.com/api-context': '/test-context',
          'wso2.com/api-version': '1.0.0',
          'wso2.com/api-endpoints': JSON.stringify([
            {
              environmentName: 'Production',
              urls: ['https://gw.wso2.com/test-context/1.0.0'],
            },
          ]),
          'wso2.com/business-owner': 'John Doe',
          'wso2.com/business-owner-email': 'john@wso2.com',
          'wso2.com/technical-owner': 'Jane Smith',
          'wso2.com/technical-owner-email': 'jane@wso2.com',

        },
      },
      spec: {
        type: 'openapi',
      },
    };
  });

  it('should render all standard about card fields successfully', () => {
    render(<EntityWso2AboutCard />);

    // Name & Title
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('test-api')).toBeDefined();
    expect(screen.getByText('Display Name')).toBeDefined();
    expect(screen.getByText('Test API Title')).toBeDefined();

    // Lifecycle
    expect(screen.getByText('Lifecycle')).toBeDefined();
    expect(screen.getByText('PUBLISHED')).toBeDefined();

    // Context & Version
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.getByText('/test-context')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.0.0')).toBeDefined();

    // Description
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('This is a test WSO2 API description.')).toBeDefined();

    // Gateway URL
    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('Production (https://gw.wso2.com/test-context/1.0.0)')).toBeDefined();


    // TechDocs header vertical links
    expect(screen.getByText('View TechDocs')).toBeDefined();
    const link = screen.getByRole('link', { name: 'View TechDocs' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/catalog/default/api/test-api/wso2');

    console.log(formatTestCaseDoc(`
=== [Component: About Card Render (Standard)] ===
Rendered card with all annotations:
  - Display Name: "Test API Title"
  - Lifecycle: "PUBLISHED"
  - Context: "/test-context"
  - Version: "1.0.0"
  - Gateway: "Production (https://gw.wso2.com/test-context/1.0.0)"

  - View TechDocs URL: "/catalog/default/api/test-api/wso2"
`));
  });

  it('should render Gateway as "Unknown" if api-endpoints JSON is completely malformed', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = '{invalid-json}';
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();

    console.log(formatTestCaseDoc(`
=== [Component: About Card Render (Malformed Gateway JSON)] ===
Input: "{invalid-json}"
Resulting Gateway Field Value: "Unknown"
`));
  });

  it('should render Gateway as "None" if api-endpoints array is empty', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = JSON.stringify([]);
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('None')).toBeDefined();

    console.log(formatTestCaseDoc(`
=== [Component: About Card Render (Empty Gateway Array)] ===
Input: "[]"
Resulting Gateway Field Value: "None"
`));
  });

  it('should support Gateway endpoints defined with string urls instead of array', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = JSON.stringify([
      {
        environmentName: 'Sandbox',
        urls: 'https://sandbox.gw.wso2.com/test',
      },
    ]);
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('Sandbox (https://sandbox.gw.wso2.com/test)')).toBeDefined();
  });

  it('should support annotations prefixed with wso2-gateway.com/ as fallback', () => {
    mockEntity.metadata.annotations = {
      'wso2-gateway.com/api-lifecycle-status': 'DEPRECATED',
      'wso2-gateway.com/api-context': '/fallback-context',
      'wso2-gateway.com/api-version': '2.0.0',
    };
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('DEPRECATED')).toBeDefined();
    expect(screen.getByText('/fallback-context')).toBeDefined();
    expect(screen.getByText('2.0.0')).toBeDefined();

    console.log(formatTestCaseDoc(`
=== [Component: About Card Render (Gateway Prefixed Annotations Fallback)] ===
Annotations used prefix: 'wso2-gateway.com/'
Outcome: Lifecycle ("DEPRECATED"), Context ("/fallback-context"), and Version ("2.0.0") rendered successfully.
`));
  });

  it('should fallback display name to entity name if title is completely absent', () => {
    delete mockEntity.metadata.title;
    render(<EntityWso2AboutCard />);

    expect(screen.getAllByText('test-api').length).toBe(2);
  });

  it('should render safely if optional annotations and description are absent', () => {
    mockEntity.metadata.annotations = {};
    delete mockEntity.metadata.description;
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('test-api')).toBeDefined();

    // Check that optional fields are not rendered
    expect(screen.queryByText('Lifecycle')).toBeNull();
    expect(screen.queryByText('Context')).toBeNull();
    expect(screen.queryByText('Version')).toBeNull();
    expect(screen.queryByText('Gateway')).toBeNull();


    expect(screen.queryByText('Description')).toBeNull();

    console.log(formatTestCaseDoc(`
=== [Component: About Card Render (Minimal Specs)] ===
Description and annotations completely missing.
Outcome: Component mounted safely with Name ("test-api") and Display Name ("test-api"). All optional fields correctly bypassed.
`));
  });

  it('should display values from explicit WSO2 annotations', () => {
    mockEntity.metadata.annotations = {
      'wso2.com/api-version': '1.2.3',
      'wso2.com/api-context': '/annotation-context',
      'wso2.com/api-lifecycle-status': 'PUBLISHED',
      'wso2.com/api-provider': 'annotation-provider',
    };
    mockEntity.metadata.description = 'Description from catalog metadata';
    render(<EntityWso2AboutCard />);

    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.2.3')).toBeDefined();
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.getByText('/annotation-context')).toBeDefined();
    expect(screen.getByText('Lifecycle')).toBeDefined();
    expect(screen.getByText('PUBLISHED')).toBeDefined();
    expect(screen.getByText('Provided By')).toBeDefined();
    expect(screen.getByText('annotation-provider')).toBeDefined();

    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Description from catalog metadata')).toBeDefined();

  });
});
