import { act, renderHook } from '@testing-library/react';
import { reducer, toast, useToast } from './use-toast';

describe('use-toast', () => {
  it('reduces add, update, dismiss and remove actions', () => {
    const added = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', open: true } });
    expect(added.toasts).toHaveLength(1);
    expect(reducer(added, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'nuevo' } }).toasts[0].title).toBe('nuevo');
    expect(reducer(added, { type: 'DISMISS_TOAST', toastId: '1' }).toasts[0].open).toBe(false);
    expect(reducer(added, { type: 'REMOVE_TOAST', toastId: '1' }).toasts).toEqual([]);
    expect(reducer(added, { type: 'REMOVE_TOAST' }).toasts).toEqual([]);
  });

  it('publishes to hooks and allows update/dismiss', () => {
    const { result, unmount } = renderHook(() => useToast());
    act(() => {
      const created = toast({ title: 'hola' });
      created.update({ title: 'editado' });
      created.dismiss();
    });
    expect(result.current.toasts[0]).toMatchObject({ title: 'editado', open: false });
    act(() => result.current.dismiss());
    unmount();
  });
});
