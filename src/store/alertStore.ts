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
  dismissible?: boolean;
  
  showAlert: (
    title: string,
    message: string,
    type?: AlertType,
    buttons?: AlertButton[],
    dismissible?: boolean
  ) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  type: 'info',
  buttons: [],
  dismissible: true,

  showAlert: (title, message, type = 'info', buttons = [], dismissible = true) => {
    if (!title?.trim() && !message?.trim()) {
      return;
    }
    set({
      visible: true,
      title,
      message,
      type,
      buttons,
      dismissible,
    });
  },

  hideAlert: () => {
    set({ visible: false });
  },
}));
