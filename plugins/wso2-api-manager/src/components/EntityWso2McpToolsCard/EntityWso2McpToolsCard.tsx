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

import { useMemo } from 'react';
import {
    InfoCard,
    Table,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Wso2McpTool } from '../../api';

const MCP_TOOLS_ANNOTATION = 'wso2.com/mcp-tools';

export const EntityWso2McpToolsCard = () => {
    const { entity } = useEntity();
    const mcpToolsRaw = entity.metadata.annotations?.[MCP_TOOLS_ANNOTATION];

    const mcpTools = useMemo(() => {
        if (!mcpToolsRaw) return [];
        try {
            return JSON.parse(mcpToolsRaw) as Wso2McpTool[];
        } catch (e) {
            console.error('Failed to parse WSO2 MCP tools:', e);
            return [];
        }
    }, [mcpToolsRaw]);

    if (mcpTools.length === 0) {
        return null;
    }

    const columns = [
        { 
            title: 'Tool Name', 
            field: 'name',
            render: (rowData: any) => (
                <span style={{ fontWeight: 'bold', color: '#007acc' }}>
                  {rowData.name}
                </span>
            ),
        },
        { title: 'Description', field: 'description' },
        { title: 'Auth Type', field: 'authType' },
        { title: 'Throttling Policy', field: 'throttlingPolicy' },
    ];

    return (
        <InfoCard title="MCP Tools">
            <Table
                options={{ search: true, paging: true, pageSize: 5 }}
                columns={columns}
                data={mcpTools}
            />
        </InfoCard>
    );
};
