import { create } from 'zustand';

export interface ApprovalData {
  call: { id: string; name: string; arguments: string };
  resolve: (approved: boolean) => void;
  oldContent?: string;
  newContent?: string;
}

interface ApprovalState {
  pending: ApprovalData | null;
  setPending: (data: ApprovalData | null) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pending: null,
  setPending: (data) => set({ pending: data }),
}));
