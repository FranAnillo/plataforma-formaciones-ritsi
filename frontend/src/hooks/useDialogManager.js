import { useState } from 'react';

export const useDialogManager = () => {
  const [dialogState, setDialogState] = useState({
    createContent: false,
    assignContent: false,
    editCategory: null,
    deleteCategory: null,
    createCommission: false,
    editCommission: null,
    deleteCommission: null,
    assignToCommission: null,
  });

  const openDialog = (dialog, data = true) => {
    setDialogState(prev => ({ ...prev, [dialog]: data }));
  };

  const closeDialog = (dialog) => {
    const defaultValue = typeof dialogState[dialog] === 'boolean' ? false : null;
    setDialogState(prev => ({ ...prev, [dialog]: defaultValue }));
  };

  const getDialogProps = (dialog) => {
    const isOpen = typeof dialogState[dialog] === 'boolean' 
      ? dialogState[dialog] 
      : !!dialogState[dialog];
      
    return {
      open: isOpen,
      onOpenChange: (open) => !open && closeDialog(dialog),
      data: dialogState[dialog],
    };
  };

  return { openDialog, closeDialog, getDialogProps };
};