import React, { useContext, useRef, useState, useEffect, useId, useCallback } from "react";
import ReactDOM from "react-dom";
import "./Modal.css";

const ModalContext = React.createContext();

export function ModalProvider({ children }) {
  const modalRef = useRef();
  const [value, setValue] = useState();

  useEffect(() => {
    setValue(modalRef.current);
  }, []);

  return (
    <>
      <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
      <div ref={modalRef} />
    </>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: role="dialog" + aria-modal, labelled by the first heading
// inside it, focus moves in when it opens, Tab is kept inside, Escape closes it
// and focus goes back to the button that opened it.
export function Modal({ onClose, children }) {
  const modalNode = useContext(ModalContext);
  const contentRef = useRef(null);
  const fallbackId = useId();
  const [labelId, setLabelId] = useState(undefined);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !contentRef.current) return;
    const items = Array.from(contentRef.current.querySelectorAll(FOCUSABLE));
    if (!items.length) {
      e.preventDefault();
      contentRef.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === contentRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!modalNode) return undefined;
    const opener = document.activeElement;
    const node = contentRef.current;
    if (node) {
      const heading = node.querySelector('h1, h2, h3');
      if (heading) {
        if (!heading.id) heading.id = `${fallbackId}-title`;
        setLabelId(heading.id);
      }
      const target = node.querySelector('input, textarea, select') || node.querySelector(FOCUSABLE) || node;
      target.focus();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [modalNode, fallbackId]);

  if (!modalNode) return null;

  return ReactDOM.createPortal(
    <div id="modal">
      {/* Mouse-only shortcut: keyboard users close with Escape or the Cancel button. */}
      <div id="modal-background" onClick={onClose} aria-hidden="true" />
      {/* The dialog itself handles Escape and the Tab focus trap (standard dialog pattern). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div id="modal-content" ref={contentRef} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>,
    modalNode
  );
}
