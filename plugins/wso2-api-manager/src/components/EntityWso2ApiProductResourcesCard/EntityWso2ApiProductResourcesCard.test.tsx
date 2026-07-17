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
import '@testing-library/jest-dom';
import { EntityWso2ApiProductResourcesCard } from './EntityWso2ApiProductResourcesCard';

const mockEntity = {
  metadata: {
    name: 'test-entity',
    namespace: 'default',
    annotations: {},
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
  Table: ({ columns, data }: any) => (
    <table>
      <thead>
        <tr>
          {columns.map((column: any) => (
            <th key={column.title}>{column.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, rowIndex: number) => (
          <tr key={rowIndex}>
            {columns.map((column: any) => (
              <td key={column.title}>
                {column.render
                  ? column.render(row)
                  : String(row[column.field] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

describe('EntityWso2ApiProductResourcesCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockEntity.metadata.annotations = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders null when the product-resources annotation is missing', () => {
    const { container } = render(<EntityWso2ApiProductResourcesCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null and logs error when product-resources annotation is invalid JSON', () => {
    mockEntity.metadata.annotations = {
      'wso2.com/product-resources': 'invalid-json',
    };
    const { container } = render(<EntityWso2ApiProductResourcesCard />);
    expect(container).toBeEmptyDOMElement();
    expect(console.error).toHaveBeenCalledWith(
      'Failed to parse WSO2 product resources:',
      expect.any(SyntaxError),
    );
  });

  it('renders resources table with correct columns and verb color coding', () => {
    const resources = [
      {
        name: 'Inventory API',
        version: '1.0.0',
        operations: [
          { target: '/items', verb: 'GET' },
          { target: '/items', verb: 'POST' },
          { target: '/items', verb: 'PUT' },
          { target: '/items', verb: 'DELETE' },
          { target: '/items', verb: 'PATCH' },
          { target: '/items', verb: 'HEAD' }, // Unknown verb fallback
        ],
      },
    ];

    mockEntity.metadata.annotations = {
      'wso2.com/product-resources': JSON.stringify(resources),
    };

    render(<EntityWso2ApiProductResourcesCard />);

    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getAllByText('Inventory API').length).toBe(6);
    expect(screen.getAllByRole('link', { name: 'Inventory API' })[0]).toHaveAttribute(
      'href',
      '/catalog/default/api/inventory-api',
    );

    // Verify verb labels are rendered
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('PUT')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
    expect(screen.getByText('PATCH')).toBeInTheDocument();
    expect(screen.getByText('HEAD')).toBeInTheDocument();
  });
});
