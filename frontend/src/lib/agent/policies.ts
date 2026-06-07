import { useApprovalStore } from '@/store/useApprovalStore';
import { api } from '@/lib/api';

export type PolicyAction = 'allow' | 'deny' | 'ask_user';

export interface Policy {
  toolName: string;
  action: PolicyAction;
}

export const allow = (toolName: string): Policy => ({ toolName, action: 'allow' });
export const deny = (toolName: string): Policy => ({ toolName, action: 'deny' });
export const ask_user = (toolName: string): Policy => ({ toolName, action: 'ask_user' });

export const evaluatePolicy = async (
  toolName: string, 
  policies: Policy[], 
  callId: string,
  callArgs: string, 
  autoApprove: boolean,
  oldContent?: string,
  newContent?: string
): Promise<boolean> => {
  if (autoApprove) return true;

  const policy = policies.find(p => p.toolName === toolName) || policies.find(p => p.toolName === '*');
  const action = policy?.action || 'deny';

  if (action === 'allow') return true;
  if (action === 'deny') return false;

  if (action === 'ask_user') {
    // 1. Register approval request on the backend so it survives restarts/refreshes
    try {
      await api.registerApproval(callId, toolName, callArgs, oldContent, newContent);
    } catch (err) {
      console.error('Failed to register approval request with backend:', err);
    }

    // 2. Wrap local resolution and background polling in a promise
    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const finish = (approved: boolean) => {
        if (resolved) return;
        resolved = true;
        clearInterval(pollInterval);
        useApprovalStore.getState().setPending(null);
        resolve(approved);
      };

      // Set pending state locally to trigger UI immediately
      useApprovalStore.getState().setPending({ 
        call: { id: callId, name: toolName, arguments: callArgs }, 
        resolve: async (approved: boolean) => {
          try {
            await Promise.race([
              api.replyApproval(callId, approved),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Approval reply timeout')), 3000)
              )
            ]);
          } catch (err) {
            console.error('Failed to submit reply to backend:', err);
          } finally {
            finish(approved);
          }
        }, 
        oldContent, 
        newContent 
      });

      // Poll the backend to detect resolution in case of browser refresh or alternative clients
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.getApprovalStatus(callId);
          if (statusRes.status !== 'pending') {
            finish(statusRes.status === 'approved');
          }
        } catch (e) {
          // Ignore polling network failures
        }
      }, 1000);
    });
  }

  return false;
};
