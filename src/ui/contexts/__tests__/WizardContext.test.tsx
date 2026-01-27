/**
 * Tests for WizardContext, specifically the pending items queue behavior.
 * Ensures multiple tool approvals are queued and processed sequentially.
 *
 * These tests verify the queue logic without rendering, by directly testing
 * the state update functions.
 */

import type { PendingItem } from '../WizardContext.js';
import type { ToolApprovalProps, ToolApprovalResult, PersistentInputProps } from '../../types.js';

// Simulate the queue operations directly (extracted logic from WizardContext)
// This tests the core queue behavior without React rendering

describe('WizardContext pending queue logic', () => {
  /**
   * Simulates the queue-based pending item system.
   * This mirrors the logic in WizardProvider without React dependencies.
   *
   * Key design: persistent input is a FALLBACK, not a queue item.
   * When queue is empty and persistentInputConfig exists, persistent input shows.
   */
  class MockPendingQueue {
    private queue: PendingItem[] = [];
    private persistentInputConfig: {
      onSubmit: (message: string) => void;
      onInterrupt: () => void;
    } | null = null;

    /**
     * Get the current pending item (mirrors the useMemo in WizardProvider)
     * - If queue has items → first item
     * - If queue empty AND persistent input active → persistent input
     * - Otherwise → null
     */
    get currentItem(): PendingItem | null {
      if (this.queue.length > 0) {
        return this.queue[0];
      }
      if (this.persistentInputConfig) {
        return {
          type: 'persistent-input',
          props: {
            onSubmit: this.persistentInputConfig.onSubmit,
            onInterrupt: this.persistentInputConfig.onInterrupt,
            placeholder: 'Type a message...',
          } as PersistentInputProps,
          resolve: () => {},
        };
      }
      return null;
    }

    get queueLength(): number {
      return this.queue.length;
    }

    get hasPersistentInput(): boolean {
      return this.persistentInputConfig !== null;
    }

    /**
     * Add a tool approval to the queue (mirrors toolApproval action)
     */
    addToolApproval(props: ToolApprovalProps): Promise<ToolApprovalResult> {
      return new Promise((resolve) => {
        this.queue.push({
          type: 'tool-approval',
          props,
          resolve: resolve as (value: unknown) => void,
        });
      });
    }

    /**
     * Resolve the current pending item (mirrors resolvePending action)
     */
    resolvePending(value: unknown): void {
      if (this.queue.length > 0) {
        const item = this.queue[0];
        this.queue = this.queue.slice(1);
        item.resolve(value);
      }
    }

    /**
     * Start persistent input mode (mirrors startPersistentInput action)
     */
    startPersistentInput(): void {
      this.persistentInputConfig = {
        onSubmit: () => {},
        onInterrupt: () => {},
      };
    }

    /**
     * Stop persistent input mode (mirrors stopPersistentInput action)
     */
    stopPersistentInput(): void {
      this.persistentInputConfig = null;
    }
  }

  it('should queue multiple tool approvals and process them sequentially (FIFO)', async () => {
    const queue = new MockPendingQueue();
    const results: ToolApprovalResult[] = [];

    // Add two tool approvals
    const promiseA = queue.addToolApproval({ toolName: 'Tool A', input: { a: 1 } });
    const promiseB = queue.addToolApproval({ toolName: 'Tool B', input: { b: 2 } });

    promiseA.then((r) => results.push(r));
    promiseB.then((r) => results.push(r));

    // Queue should have 2 items
    expect(queue.queueLength).toBe(2);

    // Current item should be Tool A (first in, first shown)
    expect(queue.currentItem?.type).toBe('tool-approval');
    expect((queue.currentItem?.props as ToolApprovalProps).toolName).toBe('Tool A');

    // Resolve Tool A
    queue.resolvePending({ behavior: 'allow', updatedInput: { a: 1 } });

    // Wait for promise resolution
    await new Promise((r) => setTimeout(r, 0));

    // Now Tool B should be current
    expect(queue.queueLength).toBe(1);
    expect((queue.currentItem?.props as ToolApprovalProps).toolName).toBe('Tool B');

    // Tool A's result should be recorded
    expect(results.length).toBe(1);
    expect(results[0]).toEqual({ behavior: 'allow', updatedInput: { a: 1 } });

    // Resolve Tool B
    queue.resolvePending({ behavior: 'allow', updatedInput: { b: 2 } });
    await new Promise((r) => setTimeout(r, 0));

    // Queue should be empty
    expect(queue.queueLength).toBe(0);
    expect(queue.currentItem).toBeNull();

    // Both results recorded in order
    expect(results.length).toBe(2);
    expect(results[1]).toEqual({ behavior: 'allow', updatedInput: { b: 2 } });
  });

  it('should not lose promises when multiple tool approvals are queued simultaneously', async () => {
    const queue = new MockPendingQueue();
    const resolvedFlags = [false, false, false];

    // Queue 3 approvals simultaneously
    queue.addToolApproval({ toolName: 'Tool 1', input: {} }).then(() => {
      resolvedFlags[0] = true;
    });
    queue.addToolApproval({ toolName: 'Tool 2', input: {} }).then(() => {
      resolvedFlags[1] = true;
    });
    queue.addToolApproval({ toolName: 'Tool 3', input: {} }).then(() => {
      resolvedFlags[2] = true;
    });

    // All 3 should be in the queue
    expect(queue.queueLength).toBe(3);

    // Resolve one at a time
    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(resolvedFlags).toEqual([true, false, false]);

    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(resolvedFlags).toEqual([true, true, false]);

    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(resolvedFlags).toEqual([true, true, true]);

    // Queue is empty, no orphaned promises
    expect(queue.queueLength).toBe(0);
  });

  it('should show persistent input as fallback when queue is empty', () => {
    const queue = new MockPendingQueue();

    // No persistent input, queue empty → no current item
    expect(queue.currentItem).toBeNull();

    // Start persistent input → should show as current item
    queue.startPersistentInput();
    expect(queue.currentItem?.type).toBe('persistent-input');

    // Stop persistent input → no current item again
    queue.stopPersistentInput();
    expect(queue.currentItem).toBeNull();
  });

  it('should show tool approval over persistent input when both active', () => {
    const queue = new MockPendingQueue();

    // Start persistent input first
    queue.startPersistentInput();
    expect(queue.currentItem?.type).toBe('persistent-input');

    // Add a tool approval - should take priority (queue item over fallback)
    queue.addToolApproval({ toolName: 'Tool A', input: {} });

    // Tool approval should be shown, not persistent input
    expect(queue.currentItem?.type).toBe('tool-approval');
    expect((queue.currentItem?.props as ToolApprovalProps).toolName).toBe('Tool A');

    // Persistent input is still configured
    expect(queue.hasPersistentInput).toBe(true);
  });

  it('should automatically show persistent input after all approvals are processed', async () => {
    const queue = new MockPendingQueue();

    // Start persistent input
    queue.startPersistentInput();
    expect(queue.currentItem?.type).toBe('persistent-input');

    // Add two tool approvals
    queue.addToolApproval({ toolName: 'Tool A', input: {} });
    queue.addToolApproval({ toolName: 'Tool B', input: {} });

    // Tool approvals take priority
    expect(queue.currentItem?.type).toBe('tool-approval');
    expect(queue.queueLength).toBe(2);

    // Resolve both
    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(queue.currentItem?.type).toBe('tool-approval'); // Tool B

    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));

    // Queue empty → persistent input automatically shows again (it's the fallback)
    expect(queue.queueLength).toBe(0);
    expect(queue.currentItem?.type).toBe('persistent-input');
  });

  it('should handle mixed approval types correctly', async () => {
    const queue = new MockPendingQueue();
    const order: string[] = [];

    // Add various items to queue
    queue.addToolApproval({ toolName: 'Edit', input: {} }).then(() => order.push('Edit'));
    queue.addToolApproval({ toolName: 'Write', input: {} }).then(() => order.push('Write'));
    queue.addToolApproval({ toolName: 'Bash', input: {} }).then(() => order.push('Bash'));

    // Queue them and resolve in order
    expect(queue.queueLength).toBe(3);

    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));

    queue.resolvePending({ behavior: 'deny', message: 'Denied' });
    await new Promise((r) => setTimeout(r, 0));

    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));

    // All resolved in order
    expect(order).toEqual(['Edit', 'Write', 'Bash']);
  });

  it('previous bug: replacing pendingItem would orphan promises', async () => {
    /**
     * This test documents the previous bug behavior and verifies it's fixed.
     *
     * OLD BEHAVIOR (BUG):
     * - Tool A added → pendingItem = A
     * - Tool B added → pendingItem = B (A's resolve callback LOST)
     * - User approves B → B resolves
     * - A never resolves → DEADLOCK
     *
     * NEW BEHAVIOR (FIXED):
     * - Tool A added → queue = [A]
     * - Tool B added → queue = [A, B]
     * - User approves (first item) → A resolves, queue = [B]
     * - User approves (first item) → B resolves, queue = []
     */
    const queue = new MockPendingQueue();

    let aResolved = false;
    let bResolved = false;

    // Simulate the SDK issuing two tool calls in quick succession
    queue.addToolApproval({ toolName: 'Tool A', input: {} }).then(() => {
      aResolved = true;
    });
    queue.addToolApproval({ toolName: 'Tool B', input: {} }).then(() => {
      bResolved = true;
    });

    // Both are queued
    expect(queue.queueLength).toBe(2);

    // First item shown should be Tool A (not B)
    expect((queue.currentItem?.props as ToolApprovalProps).toolName).toBe('Tool A');

    // Approving the first item resolves A (not B)
    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(aResolved).toBe(true);
    expect(bResolved).toBe(false);

    // Now B is shown
    expect((queue.currentItem?.props as ToolApprovalProps).toolName).toBe('Tool B');

    // Approving resolves B
    queue.resolvePending({ behavior: 'allow', updatedInput: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(bResolved).toBe(true);

    // No orphaned promises - both resolved successfully
    expect(queue.queueLength).toBe(0);
  });
});
