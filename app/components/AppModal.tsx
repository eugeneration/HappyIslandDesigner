import React from 'react';
import Modal from 'react-modal';

/**
 * Thin wrapper around react-modal that fixes the "two clicks to dismiss"
 * bug.  react-modal's built-in overlay-click detection relies on a
 * click event, which the browser swallows when it first blurs a focused
 * element inside the modal.  We disable that and close on mousedown
 * instead, which fires before the blur consumes the event.
 */
function AppModal({
  onRequestClose,
  children,
  ...rest
}: Modal.Props & { children?: React.ReactNode }) {
  return (
    // @ts-ignore - react-modal types incompatible with React 16
    <Modal
      {...rest}
      onRequestClose={onRequestClose}
      shouldFocusAfterRender={false}
      shouldCloseOnOverlayClick={false}
      overlayRef={(node) => {
        if (node) {
          node.onmousedown = (e) => {
            if (e.target === node && onRequestClose) {
              onRequestClose(e as unknown as React.MouseEvent);
            }
          };
        }
      }}
    >
      {children}
    </Modal>
  );
}

export default AppModal;
