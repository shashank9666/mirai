import { create } from 'zustand';

export interface PendingApproval {
  call: {
    id: string;
    name: string;
    arguments: string;
  };
  resolve: (approved: boolean) => void;
  oldContent?: string;
  newContent?: string;
}

interface ApprovalState {
  pending: PendingApproval | null;
  setPending: (pending: PendingApproval | null) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending })
}));
