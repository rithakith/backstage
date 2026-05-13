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

import { Button, Tooltip } from '@material-ui/core';

export const DisabledTryItOutButton = ({ message }: { message: string }) => (
  <Tooltip title={message} arrow placement="top">
    <span style={{ cursor: 'not-allowed' }}>
      <Button
        variant="contained"
        disabled
        style={{
          backgroundColor: '#f5f5f5',
          color: 'rgba(0, 0, 0, 0.26)',
          textTransform: 'none',
          fontWeight: 'bold',
          padding: '4px 12px',
        }}
      >
        Try it out
      </Button>
    </span>
  </Tooltip>
);
