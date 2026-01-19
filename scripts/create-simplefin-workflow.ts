#!/usr/bin/env bun
/**
 * SimpleFIN Bank Transaction Sync Workflow
 *
 * This script creates an n8n workflow that:
 * 1. Accepts a SimpleFIN token (user authenticates via SimpleFIN Bridge)
 * 2. Claims the access URL from the token
 * 3. Fetches bank account transactions
 * 4. Exports transactions to a local CSV file
 *
 * SimpleFIN Protocol: https://www.simplefin.org/protocol.html
 */

import { n8nFetch } from "../lib/n8n";

const WORKFLOW_NAME = "SimpleFIN Bank Transaction Sync";

// Native n8n workflow definition
const n8nWorkflow = {
  name: WORKFLOW_NAME,
  nodes: [
    {
      id: "webhook-trigger",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [100, 300],
      parameters: {
        path: "simplefin-sync",
        httpMethod: "POST",
        responseMode: "lastNode",
        options: {},
      },
      webhookId: "simplefin-sync-webhook",
    },
    {
      id: "set-token",
      name: "Set Input Parameters",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [300, 300],
      parameters: {
        mode: "manual",
        duplicateItem: false,
        assignments: {
          assignments: [
            {
              id: "token-field",
              name: "simplefinToken",
              value:
                '={{ $json.body.simplefinToken || $json.simplefinToken || "" }}',
              type: "string",
            },
            {
              id: "access-url-field",
              name: "accessUrl",
              value: '={{ $json.body.accessUrl || $json.accessUrl || "" }}',
              type: "string",
            },
            {
              id: "output-path",
              name: "outputPath",
              value:
                '={{ $json.body.outputPath || $json.outputPath || "/tmp/simplefin" }}',
              type: "string",
            },
            {
              id: "start-date",
              name: "startDate",
              value: '={{ $json.body.startDate || $json.startDate || "" }}',
              type: "string",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "check-access-url",
      name: "Check If Access URL Provided",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [450, 300],
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
          },
          conditions: [
            {
              id: "has-access-url",
              leftValue: "={{ $json.accessUrl }}",
              rightValue: "",
              operator: {
                type: "string",
                operation: "notEmpty",
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "decode-token",
      name: "Decode Token & Extract Claim URL",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [500, 300],
      parameters: {
        jsCode: `// Base64 decode the SimpleFIN token to get the claim URL
const token = $input.first().json.simplefinToken;

if (!token || token === "PASTE_YOUR_SIMPLEFIN_TOKEN_HERE") {
  throw new Error("Please provide a valid SimpleFIN token. Get one from https://bridge.simplefin.org/simplefin/create");
}

// Decode Base64 token
const claimUrl = Buffer.from(token, 'base64').toString('utf-8');

// Validate it's a URL
if (!claimUrl.startsWith('http')) {
  throw new Error("Invalid SimpleFIN token - decoded value is not a valid URL");
}

return [{
  json: {
    ...$input.first().json,
    claimUrl,
  }
}];`,
      },
    },
    {
      id: "claim-access-url",
      name: "Claim Access URL",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [700, 300],
      parameters: {
        method: "POST",
        url: "={{ $json.claimUrl }}",
        options: {
          response: {
            response: {
              fullResponse: false,
              responseFormat: "text",
            },
          },
        },
      },
    },
    {
      id: "parse-access-url",
      name: "Parse Access URL",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [900, 300],
      parameters: {
        jsCode: `// Parse the access URL to extract credentials
const accessUrl = $input.first().json.data;
const previousData = $('Set SimpleFIN Token').first().json;

if (!accessUrl || !accessUrl.includes('@')) {
  throw new Error("Failed to claim access URL. Token may be expired or already used.");
}

// Parse URL with embedded credentials: https://user:pass@host/path
const urlMatch = accessUrl.match(/^(https?):\\/\\/([^:]+):([^@]+)@(.+)$/);

if (!urlMatch) {
  throw new Error("Invalid access URL format");
}

const [, protocol, username, password, hostPath] = urlMatch;
const baseUrl = \`\${protocol}://\${hostPath}\`;

return [{
  json: {
    ...previousData,
    accessUrl,
    baseUrl,
    username,
    password,
    accountsUrl: \`\${baseUrl}/accounts\`,
  }
}];`,
      },
    },
    {
      id: "fetch-accounts",
      name: "Fetch Accounts & Transactions",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1100, 300],
      parameters: {
        method: "GET",
        url: "={{ $json.accountsUrl }}",
        authentication: "genericCredentialType",
        genericAuthType: "httpBasicAuth",
        sendQuery: true,
        queryParameters: {
          parameters: [
            {
              name: "start-date",
              value:
                '={{ $json.startDate ? Math.floor(new Date($json.startDate).getTime() / 1000) : "" }}',
            },
          ],
        },
        options: {
          response: {
            response: {
              fullResponse: false,
              responseFormat: "json",
            },
          },
        },
      },
      credentials: {
        httpBasicAuth: {
          id: "simplefin-auth",
          name: "SimpleFIN Auth",
        },
      },
    },
    {
      id: "handle-auth-inline",
      name: "Fetch with Inline Auth",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1100, 500],
      parameters: {
        method: "GET",
        url: "={{ $json.accessUrl + '/accounts' }}",
        authentication: "none",
        sendQuery: true,
        queryParameters: {
          parameters: [
            {
              name: "start-date",
              value:
                '={{ $json.startDate ? Math.floor(new Date($json.startDate).getTime() / 1000) : "" }}',
            },
          ],
        },
        options: {
          response: {
            response: {
              fullResponse: false,
              responseFormat: "json",
            },
          },
        },
      },
    },
    {
      id: "merge-data",
      name: "Merge Account Data",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1200, 500],
      parameters: {
        jsCode: `// Merge account data with previous context
// Handle both paths: direct access URL or claimed from token
let previousData;
try {
  previousData = $('Parse Access URL').first().json;
} catch {
  previousData = $('Use Existing Access URL').first().json;
}

const accountData = $input.first().json;

return [{
  json: {
    ...previousData,
    accountData,
  }
}];`,
      },
    },
    {
      id: "transform-to-csv",
      name: "Transform to CSV",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1300, 500],
      parameters: {
        jsCode: `// Transform account data to CSV format
const data = $input.first().json;
const accountData = data.accountData;
const outputPath = data.outputPath;

if (!accountData || !accountData.accounts) {
  throw new Error("No account data received");
}

// Check for errors from SimpleFIN
if (accountData.errors && accountData.errors.length > 0) {
  console.log("SimpleFIN warnings:", accountData.errors);
}

// Collect all transactions from all accounts
const transactions = [];

for (const account of accountData.accounts) {
  const orgName = account.org?.name || account.org?.domain || "Unknown";

  if (account.transactions) {
    for (const tx of account.transactions) {
      transactions.push({
        date: tx.posted ? new Date(tx.posted * 1000).toISOString().split('T')[0] : '',
        transacted_date: tx.transacted_at ? new Date(tx.transacted_at * 1000).toISOString().split('T')[0] : '',
        account_id: account.id,
        account_name: account.name,
        organization: orgName,
        transaction_id: tx.id,
        amount: tx.amount,
        currency: account.currency,
        description: tx.description,
        pending: tx.pending ? 'yes' : 'no',
        category: tx.extra?.category || '',
      });
    }
  }
}

// Sort by date descending
transactions.sort((a, b) => b.date.localeCompare(a.date));

// Generate CSV
const headers = [
  'date', 'transacted_date', 'account_id', 'account_name',
  'organization', 'transaction_id', 'amount', 'currency',
  'description', 'pending', 'category'
];

const csvRows = [headers.join(',')];

for (const tx of transactions) {
  const row = headers.map(h => {
    const val = tx[h] || '';
    // Escape quotes and wrap in quotes if contains comma or quote
    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\\n'))) {
      return \`"\${val.replace(/"/g, '""')}"\`;
    }
    return val;
  });
  csvRows.push(row.join(','));
}

const csvContent = csvRows.join('\\n');

// Summary
const summary = {
  totalAccounts: accountData.accounts.length,
  totalTransactions: transactions.length,
  accounts: accountData.accounts.map(a => ({
    name: a.name,
    balance: a.balance,
    currency: a.currency,
    transactionCount: a.transactions?.length || 0,
  })),
};

return [{
  json: {
    outputPath,
    summary,
    csvContent,
    transactionCount: transactions.length,
  }
}];`,
      },
    },
    {
      id: "write-csv",
      name: "Return Data",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1500, 500],
      parameters: {
        jsCode: `// Return all data in the response for preservation
// n8n blocks filesystem access, so we return data for external storage

const data = $input.first().json;
const timestamp = new Date().toISOString();

return [{
  json: {
    success: true,
    timestamp,
    message: \`Retrieved \${data.summary.totalAccounts} accounts with \${data.transactionCount} transactions\`,
    summary: data.summary,
    // Include raw data for preservation
    rawResponse: data.accountData,
    csvContent: data.csvContent,
    accessUrl: data.accessUrl,
  }
}];`,
      },
    },
    {
      id: "skip-to-fetch",
      name: "Use Existing Access URL",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [600, 200],
      parameters: {
        mode: "manual",
        duplicateItem: false,
        assignments: {
          assignments: [
            {
              id: "keep-data",
              name: "accessUrl",
              value: "={{ $json.accessUrl }}",
              type: "string",
            },
            {
              id: "keep-output",
              name: "outputPath",
              value: "={{ $json.outputPath }}",
              type: "string",
            },
            {
              id: "keep-start",
              name: "startDate",
              value: "={{ $json.startDate }}",
              type: "string",
            },
          ],
        },
        options: {},
      },
    },
  ],
  connections: {
    "Webhook Trigger": {
      main: [[{ node: "Set Input Parameters", type: "main", index: 0 }]],
    },
    "Set Input Parameters": {
      main: [
        [{ node: "Check If Access URL Provided", type: "main", index: 0 }],
      ],
    },
    "Check If Access URL Provided": {
      main: [
        // True branch (has access URL) - skip claim
        [{ node: "Use Existing Access URL", type: "main", index: 0 }],
        // False branch (no access URL) - need to claim token
        [{ node: "Decode Token & Extract Claim URL", type: "main", index: 0 }],
      ],
    },
    "Use Existing Access URL": {
      main: [[{ node: "Fetch with Inline Auth", type: "main", index: 0 }]],
    },
    "Decode Token & Extract Claim URL": {
      main: [[{ node: "Claim Access URL", type: "main", index: 0 }]],
    },
    "Claim Access URL": {
      main: [[{ node: "Parse Access URL", type: "main", index: 0 }]],
    },
    "Parse Access URL": {
      main: [[{ node: "Fetch with Inline Auth", type: "main", index: 0 }]],
    },
    "Fetch with Inline Auth": {
      main: [[{ node: "Merge Account Data", type: "main", index: 0 }]],
    },
    "Merge Account Data": {
      main: [[{ node: "Transform to CSV", type: "main", index: 0 }]],
    },
    "Transform to CSV": {
      main: [[{ node: "Return Data", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    availableInMCP: true,
  },
};

async function createWorkflow() {
  console.log("Creating SimpleFIN Bank Transaction Sync workflow...\n");

  try {
    // Check if workflow already exists
    const { data: existingWorkflows } = (await n8nFetch(
      "/api/v1/workflows",
    )) as {
      data: Array<{ id: string; name: string }>;
    };

    const existing = existingWorkflows.find((w) => w.name === WORKFLOW_NAME);
    if (existing) {
      console.log(
        `Workflow "${WORKFLOW_NAME}" already exists (ID: ${existing.id})`,
      );
      console.log("Updating existing workflow...\n");

      const updated = await n8nFetch(`/api/v1/workflows/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nWorkflow),
      });

      console.log("Workflow updated successfully!");
      console.log(`ID: ${(updated as { id: string }).id}`);
      return updated;
    }

    // Create new workflow
    const created = await n8nFetch("/api/v1/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nWorkflow),
    });

    console.log("Workflow created successfully!");
    console.log(`ID: ${(created as { id: string }).id}`);
    console.log(`Name: ${(created as { name: string }).name}`);

    return created;
  } catch (error) {
    console.error("Failed to create workflow:", error);
    throw error;
  }
}

// Usage instructions
function printUsage() {
  console.log(`
================================================================================
  SimpleFIN Bank Transaction Sync Workflow
================================================================================

This workflow syncs bank transactions from SimpleFIN to a local CSV file.

HOW TO USE:

1. Get a SimpleFIN Token:
   - Visit: https://bridge.simplefin.org/simplefin/create
   - Connect your bank account
   - Copy the SimpleFIN Token provided

2. Execute the workflow in n8n:
   - Open the workflow in n8n
   - Click "Execute Workflow"
   - In the "Set SimpleFIN Token" node, paste your token
   - Optionally set:
     - outputPath: Where to save the CSV (default: /tmp/bank_transactions.csv)
     - startDate: Only fetch transactions after this date (ISO format)

3. The workflow will:
   - Decode your SimpleFIN token
   - Claim the access URL (one-time use)
   - Fetch your account data and transactions
   - Export everything to a CSV file

SECURITY NOTES:
   - SimpleFIN tokens are one-time use for claiming
   - Store access URLs securely (they contain credentials)
   - The CSV file contains sensitive financial data

================================================================================
`);
}

// Main execution
printUsage();
createWorkflow()
  .then(() => {
    console.log("\n✓ Workflow is now available in n8n!");
    console.log("  Open n8n to view and execute the workflow.");
  })
  .catch((err) => {
    console.error("\n✗ Failed:", err.message);
    process.exit(1);
  });
