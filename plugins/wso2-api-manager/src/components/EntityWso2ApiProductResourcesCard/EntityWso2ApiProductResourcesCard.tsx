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
    Link,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Wso2ApiProductResource } from '../../api';

const PRODUCT_RESOURCES_ANNOTATION = 'wso2.com/product-resources';

const getVerbColor = (verb: string) => {
    switch (verb.toUpperCase()) {
        case 'GET': return '#61affe';
        case 'POST': return '#49cc90';
        case 'PUT': return '#fca130';
        case 'DELETE': return '#f93e3e';
        case 'PATCH': return '#50e3c2';
        default: return '#999';
    }
};

export const EntityWso2ApiProductResourcesCard = () => {
    const { entity } = useEntity();
    const productResourcesRaw = entity.metadata.annotations?.[PRODUCT_RESOURCES_ANNOTATION];
    const namespace = entity.metadata.namespace || 'default';

    const data = useMemo(() => {
        if (!productResourcesRaw) return [];
        try {
            const resources = JSON.parse(productResourcesRaw) as Wso2ApiProductResource[];
            return resources.flatMap(res => 
                res.operations.map(op => ({
                    name: res.name,
                    version: res.version,
                    target: op.target,
                    verb: op.verb,
                }))
            );
        } catch (e) {
            console.error('Failed to parse WSO2 product resources:', e);
            return [];
        }
    }, [productResourcesRaw]);

    if (data.length === 0) {
        return null;
    }

    const columns = [
        { 
            title: 'API Name', 
            field: 'name',
            render: (rowData: any) => {
                const normalizedName = rowData.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                return (
                    <Link
                      to={`/catalog/${namespace}/api/${normalizedName}`}
                      style={{ fontWeight: 'bold', color: '#007acc' }}
                    >
                      {rowData.name}
                    </Link>
                );
            },
        },
        { title: 'Version', field: 'version' },
        { title: 'Path', field: 'target' },
        { 
            title: 'Method', 
            field: 'verb',
            render: (rowData: any) => (
                <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: getVerbColor(rowData.verb),
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                }}>
                    {rowData.verb}
                </span>
            )
        },
    ];

    return (
        <InfoCard title="Resources">
            <Table
                options={{ search: true, paging: true, pageSize: 5 }}
                columns={columns}
                data={data}
            />
        </InfoCard>
    );
};
