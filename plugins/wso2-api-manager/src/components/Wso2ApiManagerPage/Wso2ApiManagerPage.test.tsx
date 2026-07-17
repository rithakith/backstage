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
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Wso2ApiManagerPage } from './Wso2ApiManagerPage';

const mockWso2Api = {
  getGateways: jest.fn(),
  getCatalogSyncStatus: jest.fn(),
  getServices: jest.fn(),
  getServiceUsage: jest.fn(),
  getServiceDefinition: jest.fn(),
};

const mockOAuthApi = {
  getAccessToken: jest.fn(),
};

const mockCatalogApi = {
  getEntities: jest.fn(),
};

const mockConfigApi = {
  getOptionalNumber: jest.fn(),
};

jest.mock('../../api', () => ({
  wso2ApiManagerApiRef: { id: 'plugin.wso2-api-manager.service' },
  wso2AuthApiRef: { id: 'plugin.wso2-api-manager.auth' },
}));

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  useApi: (apiRef: { id: string }) => {
    if (apiRef.id === 'plugin.wso2-api-manager.service') {
      return mockWso2Api;
    }
    if (apiRef.id === 'plugin.wso2-api-manager.auth') {
      return mockOAuthApi;
    }
    if (apiRef.id === 'core.config') {
      return mockConfigApi;
    }
    if (apiRef.id === 'plugin.catalog.service') {
      return mockCatalogApi;
    }
    throw new Error(`Unexpected apiRef: ${apiRef.id}`);
  },
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'plugin.catalog.service' },
}));

jest.mock('@backstage/core-components', () => ({
  Content: ({ children }: any) => <main>{children}</main>,
  ContentHeader: ({ children }: any) => <div>{children}</div>,
  Header: ({ title, subtitle }: any) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
  Page: ({ children }: any) => <div>{children}</div>,
  Table: ({ columns, data, detailPanel }: any) => (
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
          <React.Fragment key={row.id || row.name || rowIndex}>
            <tr>
              {columns.map((column: any) => (
                <td key={column.title}>
                  {column.render
                    ? column.render(row)
                    : String(row[column.field] ?? '')}
                </td>
              ))}
            </tr>
            {detailPanel && (
              <tr>
                <td colSpan={columns.length} data-testid="detail-panel">
                  {detailPanel(row)}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  ),
  WarningPanel: ({ title, message, children }: any) => (
    <section role="alert">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {children}
    </section>
  ),
}));

const catalogEntities = [
  {
    kind: 'API',
    metadata: {
      name: 'customer-api',
      namespace: 'wso2',
      annotations: {
        'wso2.com/api-id': 'api-1',
        'wso2.com/api-name': 'Customer API',
        'wso2.com/api-version': '1.0.0',
        'wso2.com/api-context': '/customers',
        'wso2.com/api-lifecycle-status': 'PUBLISHED',
        'wso2.com/api-type': 'HTTP',
        'wso2.com/api-gateway': 'wso2',
      },
    },
  },
  {
    kind: 'API',
    metadata: {
      name: 'sales-product',
      namespace: 'wso2',
      title: 'Sales Product',
      annotations: {
        'wso2.com/api-id': 'product-1',
        'wso2.com/is-api-product': 'true',
        'wso2.com/api-name': 'Sales Product',
        'wso2.com/api-version': '2.0.0',
        'wso2.com/api-context': '/sales',
        'wso2.com/api-lifecycle-status': 'PUBLISHED',
        'wso2.com/api-gateway': 'wso2',
      },
    },
  },
  {
    kind: 'API',
    metadata: {
      name: 'agent-mcp',
      namespace: 'wso2',
      description: 'Agent tools',
      annotations: {
        'wso2.com/api-id': 'mcp-1',
        'wso2.com/is-mcp-server': 'true',
        'wso2.com/api-name': 'Agent MCP',
        'wso2.com/api-version': '1.1.0',
        'wso2.com/api-context': '/agent',
        'wso2.com/api-lifecycle-status': 'PUBLISHED',
      },
    },
  },
  {
    kind: 'API',
    metadata: {
      name: 'inventory-service',
      namespace: 'wso2',
      annotations: {
        'wso2.com/is-service': 'true',
        'wso2.com/service-id': 'svc-1',
        'wso2.com/service-name': 'Inventory Service',
      },
    },
  },
];

function setupMocks(options?: {
  entities?: any[];
  gateways?: any[];
  services?: any[];
  catalogError?: Error;
  syncStatus?: any;
}) {
  mockOAuthApi.getAccessToken.mockResolvedValue('wso2-user-token');
  mockConfigApi.getOptionalNumber.mockReturnValue(60);
  mockWso2Api.getServiceUsage.mockResolvedValue({
    list: [
      { id: 'api-1', name: 'Customer API', version: '1.0.0', context: '/customers', provider: 'admin' },
    ],
  });
  mockWso2Api.getServiceDefinition.mockResolvedValue('{"swagger": "2.0"}');
  mockWso2Api.getGateways.mockResolvedValue(options?.gateways ?? []);
  mockWso2Api.getCatalogSyncStatus.mockResolvedValue(
    options?.syncStatus ?? {
      phase: 'complete',
      message: 'Catalog sync complete',
      publisherApis: { loaded: 1, total: 1 },
      totals: { catalogEntities: 1 },
    },
  );
  mockWso2Api.getServices.mockResolvedValue({
    list: options?.services ?? [
      {
        id: 'svc-1',
        name: 'Inventory Service',
        version: '1.0.0',
        serviceUrl: 'https://services.example.com/inventory',
        definitionType: 'OAS',
        usage: '1 API',
      },
    ],
  });

  if (options?.catalogError) {
    mockCatalogApi.getEntities.mockRejectedValue(options.catalogError);
  } else {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: options?.entities ?? catalogEntities,
    });
  }
}

describe('Wso2ApiManagerPage', () => {
  beforeAll(() => {
    global.URL.createObjectURL = jest.fn().mockReturnValue('mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setupMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the page header, filters, tabs, and API table rows', async () => {
    render(<Wso2ApiManagerPage />);

    expect(screen.getByText('WSO2 API Manager')).toBeInTheDocument();
    expect(screen.getAllByText('Select Type').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Select Gateway').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'APIs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'API Products' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'MCPs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Services' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Customer API')).toBeInTheDocument();
    });

    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
    expect(screen.getByText('/customers')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Customer API' })).toHaveAttribute(
      'href',
      '/catalog/wso2/api/customer-api',
    );
  });

  it('shows an API loading state while catalog entities are still loading', async () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));

    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Fetching APIs from WSO2...')).toBeInTheDocument();
  });

  it('shows a catalog synchronization empty state when no APIs are available yet', async () => {
    setupMocks({ entities: [] });

    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Synchronizing Catalog...')).toBeInTheDocument();
    expect(
      screen.getByText(/We're currently discovering APIs from your WSO2/),
    ).toBeInTheDocument();
  });

  it('shows a blocking API error when catalog loading fails', async () => {
    setupMocks({ catalogError: new Error('Catalog is unavailable') });

    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Failed to load APIs')).toBeInTheDocument();
    expect(screen.getByText('Catalog is unavailable')).toBeInTheDocument();
  });

  it('shows offline gateway warnings while keeping catalog APIs visible', async () => {
    setupMocks({
      gateways: [
        {
          name: 'Hybrid Gateway',
          status: 'Offline',
          gatewayType: 'hybrid',
          discoveredApis: [],
        },
      ],
    });

    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Gateway Discovery Warning')).toBeInTheDocument();
    expect(screen.getByText(/Hybrid Gateway/)).toBeInTheDocument();
    expect(screen.getByText('Customer API')).toBeInTheDocument();
  });

  it('renders API Products, MCPs, and Services from their tabs', async () => {
    render(<Wso2ApiManagerPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer API')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'API Products' }));
    expect(await screen.findByText('Sales Product')).toBeInTheDocument();
    expect(screen.getByText('/sales')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'MCPs' }));
    expect(await screen.findByText('Agent MCP')).toBeInTheDocument();
    expect(screen.getByText('Agent tools')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    expect(await screen.findByText('Inventory Service')).toBeInTheDocument();
    expect(screen.getByText('https://services.example.com/inventory')).toBeInTheDocument();

    // Verify detailPanel contents (rendered because of mock Table changes)
    expect(await screen.findByText('Service Usage')).toBeInTheDocument();
    expect(screen.getByText('Definition')).toBeInTheDocument();

    // Click download button
    const downloadBtn = screen.getByRole('button', { name: 'Download' });
    fireEvent.click(downloadBtn);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('merges live gateway-discovered APIs into the API table', async () => {
    setupMocks({
      gateways: [
        {
          name: 'Kong Runtime',
          status: 'Online',
          gatewayType: 'kong',
          discoveredApis: [
            {
              id: 'live-api-1',
              name: 'Live Gateway API',
              version: '1.0.0',
              context: '/live',
              type: 'HTTP',
            },
          ],
        },
      ],
    });
    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Customer API')).toBeInTheDocument();
    expect(screen.getByText('Live Gateway API')).toBeInTheDocument();
    expect(screen.getByText('/live')).toBeInTheDocument();
  });

  it('filters APIs by selecting a type and gateway', async () => {
    render(<Wso2ApiManagerPage />);
    await screen.findByText('Customer API');

    // Material-UI Select trigger is a button/div with role button
    const typeSelect = screen.getByRole('button', { name: /Select Type/i });
    fireEvent.mouseDown(typeSelect);
    const typeOption = await screen.findByRole('option', { name: 'HTTP' });
    fireEvent.click(typeOption);

    const gatewaySelect = screen.getByRole('button', { name: /Select Gateway/i });
    fireEvent.mouseDown(gatewaySelect);
    const gatewayOption = await screen.findByRole('option', { name: 'WSO2' });
    fireEvent.click(gatewayOption);
  });

  it('renders API Products empty state', async () => {
    setupMocks({ entities: [] });
    render(<Wso2ApiManagerPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'API Products' }));
    expect(await screen.findByText('Discovering API Products...')).toBeInTheDocument();
  });

  it('renders MCP empty state', async () => {
    setupMocks({ entities: [] });
    render(<Wso2ApiManagerPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'MCPs' }));
    expect(await screen.findByText('Scanning for MCP Servers...')).toBeInTheDocument();
  });

  it('renders Services error state', async () => {
    mockWso2Api.getServices.mockRejectedValue(new Error('Failed service fetch'));
    render(<Wso2ApiManagerPage />);
    await screen.findByText('Customer API'); // Wait for initial catalog load to complete
    
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    expect(await screen.findByText('Failed to load Services')).toBeInTheDocument();
  });

  it('extracts gateways correctly from various annotations', async () => {
    const customEntities = [
      {
        kind: 'API',
        metadata: {
          name: 'gw-api-1',
          namespace: 'wso2',
          annotations: {
            'wso2.com/api-id': 'api-gw-1',
            'wso2.com/api-name': 'GW API 1',
            'wso2.com/api-endpoints': JSON.stringify([
              {
                environmentName: 'prod-env',
                displayName: 'Production Environment',
                gatewayType: 'wso2/synapse',
              }
            ]),
          },
        },
      },
      {
        kind: 'API',
        metadata: {
          name: 'gw-api-2',
          namespace: 'wso2',
          annotations: {
            'wso2.com/api-id': 'api-gw-2',
            'wso2.com/api-name': 'GW API 2',
            'wso2.com/gateway-endpoints': JSON.stringify([
              {
                name: 'staging-gw',
                gatewayType: 'kong',
              }
            ]),
            'wso2-gateway.com/discovered-from': 'discovered-env',
          },
        },
      },
      {
        kind: 'API',
        metadata: {
          name: 'gw-api-3',
          namespace: 'wso2',
          annotations: {
            'wso2.com/api-id': 'api-gw-3',
            'wso2.com/api-name': 'GW API 3',
            'wso2.com/api-gateway-vendor': 'apigee',
          },
        },
      },
      {
        kind: 'API',
        metadata: {
          name: 'gw-api-4',
          namespace: 'wso2',
          annotations: {
            'wso2.com/api-id': 'api-gw-4',
            'wso2.com/api-name': 'GW API 4',
            'wso2.com/api-endpoints': 'invalid-json',
          },
        },
      },
      {
        kind: 'API',
        metadata: {
          name: 'gw-api-5',
          namespace: 'wso2',
          annotations: {
            'wso2.com/api-id': 'api-gw-5',
            'wso2.com/api-name': 'GW API 5',
            'wso2.com/gateway-endpoints': 'invalid-json',
          },
        },
      },
    ];

    setupMocks({ entities: customEntities });
    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('GW API 1')).toBeInTheDocument();
    expect(screen.getByText('GW API 2')).toBeInTheDocument();
    expect(screen.getByText('GW API 3')).toBeInTheDocument();
    expect(screen.getByText('GW API 4')).toBeInTheDocument();
    expect(screen.getByText('GW API 5')).toBeInTheDocument();
  });

  it('handles service detail panel errors and non-json definitions', async () => {
    setupMocks({
      services: [
        {
          id: 'svc-1',
          name: 'Service 1',
          version: '1.0.0',
          serviceUrl: 'https://example.com/1',
          definitionType: 'OAS',
          usage: '1 API',
        },
        {
          name: 'Service No ID',
          version: '1.0.0',
          serviceUrl: 'https://example.com/no-id',
          definitionType: 'OAS',
          usage: '1 API',
        }
      ]
    });
    mockWso2Api.getServiceDefinition.mockImplementation(async (id) => {
      if (id === 'svc-1') {
        return 'invalid json definition text';
      }
      return '{"swagger": "2.0"}';
    });

    render(<Wso2ApiManagerPage />);
    await screen.findByText('Customer API');

    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    expect(await screen.findByText('Service 1')).toBeInTheDocument();
    expect(screen.getByText('Service No ID')).toBeInTheDocument();
    expect(screen.getByText('invalid json definition text')).toBeInTheDocument();
    expect((await screen.findAllByText(/Service ID is undefined/)).length).toBeGreaterThan(0);
  });

  it('merges live gateway-discovered APIs matching catalog API', async () => {
    setupMocks({
      gateways: [
        {
          name: 'Kong Runtime',
          status: 'Online',
          gatewayType: 'kong',
          discoveredApis: [
            {
              id: 'api-1',
              name: 'Customer API',
              version: '1.0.0',
              context: '/customers',
              type: 'HTTP',
            },
          ],
        },
      ],
    });
    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Customer API')).toBeInTheDocument();
  });

  it('handles gateway fetch error', async () => {
    mockWso2Api.getGateways.mockRejectedValueOnce(new Error('Gateway fetch failed'));
    render(<Wso2ApiManagerPage />);
    expect(await screen.findByText('Customer API')).toBeInTheDocument();
  });

  it('allows manual refresh during synchronization', async () => {
    setupMocks({ entities: [] });
    render(<Wso2ApiManagerPage />);
    const refreshBtn = await screen.findByRole('button', { name: 'Refresh Now' });
    fireEvent.click(refreshBtn);
    expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(2);
  });

  it('handles sync timeout and retry across tabs', async () => {
    jest.useFakeTimers();
    setupMocks({ entities: [] });
    // First call resolves to empty array, subsequent calls never resolve
    mockCatalogApi.getEntities
      .mockResolvedValueOnce({ items: [] })
      .mockReturnValue(new Promise(() => {}));

    render(<Wso2ApiManagerPage />);

    // Flush microtasks to settle the first catalogState promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    // Advance time to trigger timeout
    act(() => {
      jest.advanceTimersByTime(65000);
    });

    expect(screen.getByText('Sync Timed Out')).toBeInTheDocument();

    // Trigger timeout states on other tabs
    fireEvent.click(screen.getByRole('tab', { name: 'API Products' }));
    expect(screen.getByText('Sync Timed Out')).toBeInTheDocument();

    // Go back and retry
    fireEvent.click(screen.getByRole('tab', { name: 'APIs' }));
    const retryBtn = screen.getByRole('button', { name: 'Retry Now' });
    fireEvent.click(retryBtn);

    jest.useRealTimers();
  });

  it('keeps showing sync progress when publisher APIs are still loading', async () => {
    jest.useFakeTimers();
    setupMocks({
      entities: [],
      syncStatus: {
        phase: 'fetching',
        message: 'Fetching Publisher APIs',
        publisherApis: { loaded: 30, total: 130 },
        totals: {},
      },
    });

    render(<Wso2ApiManagerPage />);

    expect(await screen.findByText('Synchronizing Catalog...')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(65000);
    });

    expect(screen.queryByText('Sync Timed Out')).not.toBeInTheDocument();
    expect(screen.getByText('30/130 Publisher APIs loaded')).toBeInTheDocument();
  });

  it('handles MCPs sync timeout when catalog never resolves', async () => {
    jest.useFakeTimers();
    setupMocks({ entities: [] });
    // Catalog never resolves
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));

    render(<Wso2ApiManagerPage />);

    // Advance time to trigger timeout
    act(() => {
      jest.advanceTimersByTime(65000);
    });

    // Go to MCPs tab
    fireEvent.click(screen.getByRole('tab', { name: 'MCPs' }));
    expect(screen.getByText('Sync Timed Out')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('shows no APIs empty state when catalog is empty and gateway discovery fails', async () => {
    setupMocks({
      entities: [],
      gateways: [
        {
          name: 'Offline Gateway',
          status: 'Offline',
          gatewayType: 'wso2',
          discoveredApis: [],
        },
      ],
    });
    render(<Wso2ApiManagerPage />);
    expect(await screen.findByText('No APIs Available')).toBeInTheDocument();
  });
});
