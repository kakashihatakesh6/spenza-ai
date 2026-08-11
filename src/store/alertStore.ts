import { create } from 'zustand';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: AlertType;
  buttons: AlertButton[];
  
  showAlert: (
    title: string,
    message: string,
    type?: AlertType,
    buttons?: AlertButton[]
  ) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  type: 'info',
  buttons: [],

  showAlert: (title, message, type = 'info', buttons = []) => {
    if (!title?.trim() && !message?.trim()) {
      return;
    }
    set({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  },

  hideAlert: () => {
    set({ visible: false });
  },
}));
