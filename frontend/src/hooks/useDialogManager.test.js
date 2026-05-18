import { act, renderHook } from '@testing-library/react';
import { useDialogManager } from './useDialogManager';

describe('useDialogManager', () => {
  it('opens, closes and exposes boolean and data-backed dialogs', () => {
    const { result } = renderHook(() => useDialogManager());
    expect(result.current.getDialogProps('createContent')).toMatchObject({ open: false, data: false });
    expect(result.current.getDialogProps('editCategory')).toMatchObject({ open: false, data: null });

    act(() => result.current.openDialog('createContent'));
    expect(result.current.getDialogProps('createContent')).toMatchObject({ open: true, data: true });

    const category = { id: 'cat' };
    act(() => result.current.openDialog('editCategory', category));
    expect(result.current.getDialogProps('editCategory')).toMatchObject({ open: true, data: category });

    act(() => result.current.getDialogProps('editCategory').onOpenChange(false));
    expect(result.current.getDialogProps('editCategory')).toMatchObject({ open: false, data: null });

    act(() => result.current.closeDialog('createContent'));
    expect(result.current.getDialogProps('createContent')).toMatchObject({ open: false, data: false });
  });
});
