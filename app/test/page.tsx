"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface TestResult {
  status: "idle" | "loading" | "success" | "error";
  data?: unknown;
  error?: string;
}

interface TestResults {
  [key: string]: TestResult;
}

export default function TestPage() {
  const [results, setResults] = useState<TestResults>({});
  const [workflowId, setWorkflowId] = useState<string>("");
  const { register, getValues } = useForm({
    defaultValues: {
      limit: "5",
      workflowName: "Test Workflow",
      webhookPath: "test-webhook",
      updatedName: "Updated Test Workflow",
      updatedPath: "updated-test-webhook",
    },
  });

  const updateResult = (testId: string, result: TestResult) => {
    setResults((prev) => ({ ...prev, [testId]: result }));
  };

  const runTest = async (testId: string, testFn: () => Promise<unknown>) => {
    updateResult(testId, { status: "loading" });
    try {
      const data = await testFn();
      updateResult(testId, { status: "success", data });
      toast.success(`Test ${testId} passed`);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updateResult(testId, { status: "error", error: message });
      toast.error(`Test ${testId} failed`, { description: message });
      throw error;
    }
  };

  // Test 1: Health Check
  const test1_health = async () => {
    return runTest("1", async () => {
      const res = await fetch("/api/n8n/health");
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    });
  };

  // Test 2: List Workflows
  const test2_listWorkflows = async () => {
    return runTest("2", async () => {
      const res = await fetch("/api/n8n/workflows");
      if (!res.ok) throw new Error("Failed to list workflows");
      return res.json();
    });
  };

  // Test 3: List Workflows with Limit
  const test3_listWithLimit = async () => {
    return runTest("3", async () => {
      const limit = getValues("limit");
      const res = await fetch(`/api/n8n/workflows?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to list workflows with limit");
      return res.json();
    });
  };

  // Test 4: Create Workflow
  const test4_createWorkflow = async () => {
    const data = await runTest("4", async () => {
      const workflowName = getValues("workflowName");
      const webhookPath = getValues("webhookPath");
      const res = await fetch("/api/n8n/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          nodes: [
            {
              parameters: {
                path: webhookPath,
                httpMethod: "GET",
                responseMode: "onReceived",
                options: {},
              },
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              typeVersion: 1,
              position: [250, 300],
              webhookId: "test-webhook-id",
            },
          ],
          connections: {},
          settings: {},
        }),
      });
      if (!res.ok) throw new Error("Failed to create workflow");
      return res.json();
    });

    // Extract workflow ID for subsequent tests
    if (data && typeof data === "object" && "id" in data) {
      setWorkflowId(data.id as string);
    }
  };

  // Test 5: Get Workflow by ID
  const test5_getWorkflow = async () => {
    if (!workflowId) {
      toast.error("No workflow ID available. Run Test 4 first.");
      return;
    }
    return runTest("5", async () => {
      const res = await fetch(`/api/n8n/workflows/${workflowId}`);
      if (!res.ok) throw new Error("Failed to get workflow");
      return res.json();
    });
  };

  // Test 6: Update Workflow
  const test6_updateWorkflow = async () => {
    if (!workflowId) {
      toast.error("No workflow ID available. Run Test 4 first.");
      return;
    }
    return runTest("6", async () => {
      const updatedName = getValues("updatedName");
      const updatedPath = getValues("updatedPath");
      const res = await fetch(`/api/n8n/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedName,
          nodes: [
            {
              parameters: {
                path: updatedPath,
                httpMethod: "POST",
                responseMode: "onReceived",
                options: {},
              },
              name: "Webhook",
              type: "n8n-nodes-base.webhook",
              typeVersion: 1,
              position: [250, 300],
              webhookId: "updated-webhook-id",
            },
          ],
          connections: {},
          settings: {},
        }),
      });
      if (!res.ok) throw new Error("Failed to update workflow");
      return res.json();
    });
  };

  // Test 7: Activate/Deactivate Workflow
  const test7_toggleWorkflow = async () => {
    if (!workflowId) {
      toast.error("No workflow ID available. Run Test 4 first.");
      return;
    }
    return runTest("7", async () => {
      // Activate
      const activateRes = await fetch(
        `/api/n8n/workflows/${workflowId}?action=activate`,
        { method: "POST" },
      );
      if (!activateRes.ok) throw new Error("Failed to activate workflow");
      const activateData = await activateRes.json();

      // Deactivate
      const deactivateRes = await fetch(
        `/api/n8n/workflows/${workflowId}?action=deactivate`,
        { method: "POST" },
      );
      if (!deactivateRes.ok) throw new Error("Failed to deactivate workflow");
      const deactivateData = await deactivateRes.json();

      return { activate: activateData, deactivate: deactivateData };
    });
  };

  // Test 8: Delete Workflow
  const test8_deleteWorkflow = async () => {
    if (!workflowId) {
      toast.error("No workflow ID available. Run Test 4 first.");
      return;
    }
    return runTest("8", async () => {
      const res = await fetch(`/api/n8n/workflows/${workflowId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete workflow");
      const data = await res.json();
      setWorkflowId(""); // Clear workflow ID
      return data;
    });
  };

  // Run all tests sequentially
  const runAllTests = async () => {
    try {
      await test1_health();
      await test2_listWorkflows();
      await test3_listWithLimit();
      await test4_createWorkflow();
      await test5_getWorkflow();
      await test6_updateWorkflow();
      await test7_toggleWorkflow();
      await test8_deleteWorkflow();
      toast.success("All tests completed!");
    } catch (_error) {
      toast.error("Test suite stopped due to error");
    }
  };

  const TestButton = ({
    testId,
    label,
    onClick,
    disabled,
  }: {
    testId: string;
    label: string;
    onClick: () => Promise<unknown>;
    disabled?: boolean;
  }) => {
    const result = results[testId];
    const isLoading = result?.status === "loading";

    return (
      <div className="space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={isLoading || disabled}
            className="flex-1 justify-start h-9"
          >
            {isLoading && <Spinner className="mr-2 h-3 w-3" />}
            <span className="font-mono text-xs">Test {testId}</span>
            <span className="mx-2">·</span>
            <span className="text-xs">{label}</span>
          </Button>
          {result?.status === "success" && (
            <Badge variant="default" className="bg-green-600">
              ✓
            </Badge>
          )}
          {result?.status === "error" && <Badge variant="destructive">✗</Badge>}
        </div>
        {result?.status === "success" && result.data ? (
          <Textarea
            value={JSON.stringify(result.data, null, 2)}
            readOnly
            className="font-mono text-xs h-24"
          />
        ) : null}
        {result?.status === "error" && result.error && (
          <p className="text-xs text-destructive px-3">{result.error}</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-3 max-w-2xl mx-auto space-y-3">
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 pb-3 space-y-2">
        <h1 className="text-lg font-bold">n8n API Tests</h1>
        <Button onClick={runAllTests} className="w-full h-9 text-sm">
          Run All Tests
        </Button>
        {workflowId && (
          <div className="text-xs text-muted-foreground font-mono px-1">
            Workflow ID: {workflowId}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Test 1-3: No inputs needed */}
        <TestButton testId="1" label="Health Check" onClick={test1_health} />
        <TestButton
          testId="2"
          label="List Workflows"
          onClick={test2_listWorkflows}
        />

        {/* Test 3: With input */}
        <div className="space-y-2">
          <Field>
            <FieldLabel htmlFor="limit" className="text-xs">
              Test 3: List Workflows (Limit)
            </FieldLabel>
            <FieldContent>
              <div className="flex gap-2">
                <Input
                  id="limit"
                  {...register("limit")}
                  className="h-8 text-xs flex-1"
                  placeholder="5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={test3_listWithLimit}
                  disabled={results["3"]?.status === "loading"}
                  className="h-8"
                >
                  {results["3"]?.status === "loading" && (
                    <Spinner className="mr-2 h-3 w-3" />
                  )}
                  Run
                </Button>
              </div>
            </FieldContent>
          </Field>
          {results["3"]?.status === "success" && results["3"].data ? (
            <Textarea
              value={JSON.stringify(results["3"].data, null, 2)}
              readOnly
              className="font-mono text-xs h-24"
            />
          ) : null}
          {results["3"]?.status === "error" && results["3"].error && (
            <p className="text-xs text-destructive px-3">
              {results["3"].error}
            </p>
          )}
        </div>

        {/* Test 4: Create Workflow */}
        <div className="space-y-2">
          <Field>
            <FieldLabel htmlFor="workflowName" className="text-xs">
              Test 4: Create Workflow
            </FieldLabel>
            <FieldContent className="space-y-2">
              <Input
                id="workflowName"
                {...register("workflowName")}
                className="h-8 text-xs"
                placeholder="Workflow Name"
              />
              <Input
                id="webhookPath"
                {...register("webhookPath")}
                className="h-8 text-xs"
                placeholder="Webhook Path"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={test4_createWorkflow}
                disabled={results["4"]?.status === "loading"}
                className="w-full h-8"
              >
                {results["4"]?.status === "loading" && (
                  <Spinner className="mr-2 h-3 w-3" />
                )}
                Create Workflow
              </Button>
            </FieldContent>
          </Field>
          {results["4"]?.status === "success" && results["4"].data ? (
            <Textarea
              value={JSON.stringify(results["4"].data, null, 2)}
              readOnly
              className="font-mono text-xs h-24"
            />
          ) : null}
          {results["4"]?.status === "error" && results["4"].error && (
            <p className="text-xs text-destructive px-3">
              {results["4"].error}
            </p>
          )}
        </div>

        {/* Test 5: Get Workflow */}
        <TestButton
          testId="5"
          label="Get Workflow by ID"
          onClick={test5_getWorkflow}
          disabled={!workflowId}
        />

        {/* Test 6: Update Workflow */}
        <div className="space-y-2">
          <Field>
            <FieldLabel htmlFor="updatedName" className="text-xs">
              Test 6: Update Workflow
            </FieldLabel>
            <FieldContent className="space-y-2">
              <Input
                id="updatedName"
                {...register("updatedName")}
                className="h-8 text-xs"
                placeholder="Updated Name"
              />
              <Input
                id="updatedPath"
                {...register("updatedPath")}
                className="h-8 text-xs"
                placeholder="Updated Path"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={test6_updateWorkflow}
                disabled={!workflowId || results["6"]?.status === "loading"}
                className="w-full h-8"
              >
                {results["6"]?.status === "loading" && (
                  <Spinner className="mr-2 h-3 w-3" />
                )}
                Update Workflow
              </Button>
            </FieldContent>
          </Field>
          {results["6"]?.status === "success" && results["6"].data ? (
            <Textarea
              value={JSON.stringify(results["6"].data, null, 2)}
              readOnly
              className="font-mono text-xs h-24"
            />
          ) : null}
          {results["6"]?.status === "error" && results["6"].error && (
            <p className="text-xs text-destructive px-3">
              {results["6"].error}
            </p>
          )}
        </div>

        {/* Test 7: Activate/Deactivate */}
        <TestButton
          testId="7"
          label="Activate/Deactivate"
          onClick={test7_toggleWorkflow}
          disabled={!workflowId}
        />

        {/* Test 8: Delete Workflow */}
        <TestButton
          testId="8"
          label="Delete Workflow"
          onClick={test8_deleteWorkflow}
          disabled={!workflowId}
        />
      </div>
    </div>
  );
}
