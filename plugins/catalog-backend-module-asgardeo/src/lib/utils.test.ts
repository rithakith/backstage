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

import { normalizeEntityName } from './utils';

describe('normalizeEntityName', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  it('should convert letters to lowercase', () => {
    const input = 'ASGARDEO';
    const output = normalizeEntityName(input);
    expect(output).toBe('asgardeo');

    console.log(formatTestCaseDoc(`
=== [Entity Name Normalization: Case Conversion] ===
Input:  "${input}"
Output: "${output}"
`));
  });

  it('should preserve alphanumeric characters and dashes', () => {
    const input = 'my-group-123';
    const output = normalizeEntityName(input);
    expect(output).toBe('my-group-123');

    console.log(formatTestCaseDoc(`
=== [Entity Name Normalization: Preserve Allowed Characters] ===
Input:  "${input}"
Output: "${output}"
`));
  });

  it('should replace special characters and spaces with dashes', () => {
    const case1_input = 'Internal/admin group';
    const case1_output = normalizeEntityName(case1_input);
    expect(case1_output).toBe('internal-admin-group');

    const case2_input = 'user@asgardeo.io';
    const case2_output = normalizeEntityName(case2_input);
    expect(case2_output).toBe('user-asgardeo-io');

    const case3_input = 'group#$_name';
    const case3_output = normalizeEntityName(case3_input);
    expect(case3_output).toBe('group---name');

    console.log(formatTestCaseDoc(`
=== [Entity Name Normalization: Replace Forbidden Characters] ===
Test Cases:
  1. Input: "${case1_input}" -> Output: "${case1_output}"
  2. Input: "${case2_input}" -> Output: "${case2_output}"
  3. Input: "${case3_input}" -> Output: "${case3_output}"
`));
  });

  it('should handle empty strings', () => {
    const input = '';
    const output = normalizeEntityName(input);
    expect(output).toBe('');

    console.log(formatTestCaseDoc(`
=== [Entity Name Normalization: Empty Input] ===
Input:  "${input}"
Output: "${output}"
`));
  });
});
